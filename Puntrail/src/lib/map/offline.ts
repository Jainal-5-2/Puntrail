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

  // If the cemetery doesn't have a boundary polygon, we default to a small bounding box around Isabela City
  // (This assumes you haven't drawn a polygon yet)
  const defaultBbox: [number, number, number, number] = [121.9600, 6.7000, 121.9800, 6.7100]; // [west, south, east, north]
  
  let bounds: [number, number, number, number] = defaultBbox;

  if (cemetery.boundary && cemetery.boundary.type === 'Polygon') {
    const coords = cemetery.boundary.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    bounds = [
      Math.min(...lngs), // west
      Math.min(...lats), // south
      Math.max(...lngs), // east
      Math.max(...lats), // north
    ];
  }

  // 1. Create the MapLibre Offline Pack
  // Zoom levels 14 to 18 cover the cemetery perfectly.
  const pack = await OfflineManager.createPack({
    mapStyle: MAP_STYLE,
    bounds: bounds,
    minZoom: 14,
    maxZoom: 18,
    metadata: {
      cemeteryId: cemetery.id,
      name: cemetery.name,
    },
  });

  // 2. Save the pack info to SQLite so the app knows it's downloaded
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
    0, // MapLibre calculates size asynchronously via progress listener, we'll leave it 0 for now
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