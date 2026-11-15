import { OfflineManager } from '@maplibre/maplibre-react-native';
import { getDb } from '@/lib/db';
import { getCemeteryById } from '@/lib/db/cemeteries';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;

export async function downloadOfflineMap(cemeteryId: string): Promise<void> {
  if (!MAP_STYLE) {
    throw new Error('Map style URL is missing from environment variables.');
  }

  const db = await getDb();
  const cemetery = await getCemeteryById(db, cemeteryId);

  if (!cemetery) {
    throw new Error('Cemetery not found locally.');
  }

  const defaultBbox: [number, number, number, number] = [121.9600, 6.7000, 121.9800, 6.7100];
  let bounds: [number, number, number, number] = defaultBbox;

  if (cemetery.boundary && cemetery.boundary.type === 'Polygon') {
    const coords = cemetery.boundary.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    bounds = [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ];
  }

  // Wrap the download in a Promise that waits for the progress listener to hit 100%
  await new Promise<void>((resolve, reject) => {
    OfflineManager.createPack(
      {
        mapStyle: MAP_STYLE,
        bounds: bounds,
        minZoom: 14,
        maxZoom: 18,
        metadata: {
          cemeteryId: cemetery.id,
          name: cemetery.name,
        },
      },
      (_pack, progress) => {
        // progress.state can be 'complete' or 'inactive' when finished
        if (progress.state === 'complete' || progress.percentage === 100) {
          resolve();
        }
      },
      (pack, error) => {
        reject(new Error(`Map download failed: ${error.message}`));
      }
    );
  });

  const packId = `pack_${cemetery.id}`;
  const bbox = bounds;
  
  await db.runAsync(
    `INSERT INTO offline_map_packs (
       id, cemetery_id, label, size_bytes, bbox_west, bbox_south, bbox_east, bbox_north, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       size_bytes = excluded.size_bytes,
       created_at = excluded.created_at`,
    packId,
    cemetery.id,
    `${cemetery.name} Offline Map`,
    0,
    bbox[0],
    bbox[1],
    bbox[2],
    bbox[3],
    new Date().toISOString()
  );
}

export async function getOfflineMapStatus(cemeteryId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM offline_map_packs WHERE cemetery_id = ?',
    cemeteryId
  );
  return !!row;
}