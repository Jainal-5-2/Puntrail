import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getDb, listCemeteries, listPlotsByCemetery } from '@/lib/db';
import type { CachedPlot } from '@/types';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;
const DEFAULT_CENTER: [number, number] = [121.9711, 6.7054];

export default function MapScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { plotId: paramPlotId } = useLocalSearchParams<{ plotId?: string }>();

  const [plots, setPlots] = useState<CachedPlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(paramPlotId || null);

  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await getDb();
        const cemeteries = await listCemeteries(db);

        if (cemeteries.length === 0) {
          if (!cancelled) setError('No cemetery data downloaded yet.');
          return;
        }

        const activeCemetery = cemeteries[0];
        const localPlots = await listPlotsByCemetery(db, activeCemetery.id);

        if (!cancelled) {
          setPlots(localPlots);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map data.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const geojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: plots.map((p) => ({
        type: 'Feature',
        id: p.id,
        properties: {
          plot_id: p.id,
          plot_identifier: p.plot_identifier,
          is_selected: p.id === selectedPlotId,
        },
        geometry: p.geometry,
      })),
    } as GeoJSON.FeatureCollection;
  }, [plots, selectedPlotId]);

  useEffect(() => {
    if (!paramPlotId || plots.length === 0 || !cameraRef.current) return;

    const targetPlot = plots.find((p) => p.id === paramPlotId);
    if (!targetPlot) return;

    const coords =
      targetPlot.geometry.type === 'Polygon'
        ? targetPlot.geometry.coordinates[0]
        : targetPlot.geometry.coordinates[0][0];

    if (coords.length > 0) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

      cameraRef.current.flyTo({
        center: [centerLng, centerLat],
        zoom: 19,
        duration: 1000,
      });
    }
  }, [paramPlotId, plots]);

  function handlePlotPress(event: NativeSyntheticEvent<PressEventWithFeatures>) {
    const feature = event.nativeEvent.features[0];
    if (!feature) return;
    const id = feature.properties?.plot_id as string | undefined;
    if (id) {
      setSelectedPlotId(id === selectedPlotId ? null : id);
    }
  }

  const selectedPlot = plots.find((p) => p.id === selectedPlotId);

  if (!MAP_STYLE) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.danger }]}>Map style missing</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Check EXPO_PUBLIC_MAPTILER_STYLE_URL in .env
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: DEFAULT_CENTER,
            zoom: 17,
          }}
        />

        <GeoJSONSource
          id="cemetery-plots"
          data={geojson}
          onPress={handlePlotPress}>
          <Layer
            type="fill"
            id="cemetery-plots-fill"
            paint={{
              'fill-color': [
                'case',
                ['==', ['get', 'is_selected'], true],
                '#2F81F7',
                '#8B949E',
              ],
              'fill-opacity': 0.6,
              'fill-outline-color': '#0969DA',
            }}
          />
          <Layer
            type="line"
            id="cemetery-plots-outline"
            paint={{
              'line-color': '#0969DA',
              'line-width': [
                'case',
                ['==', ['get', 'is_selected'], true],
                2,
                1,
              ],
            }}
          />
        </GeoJSONSource>
      </Map>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}>
          <Text style={[styles.backText, { color: colors.text }]}>{"<"} Back</Text>
        </Pressable>
      </SafeAreaView>

      {selectedPlot && (
        <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Plot</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {selectedPlot.plot_identifier}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color: selectedPlot.geometry_verified ? colors.success : colors.warning,
                  },
                ]}>
                {selectedPlot.geometry_verified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedPlotId(null)} style={styles.closeBtn}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  errorTitle: { fontSize: 20, fontWeight: '600' },
  errorText: { fontSize: 14, textAlign: 'center' },
  backBtn: { padding: Spacing.three },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  backText: { fontSize: 14, fontWeight: '600' },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  infoCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 16, fontWeight: '600' },
  closeBtn: {
    marginTop: Spacing.two,
    alignSelf: 'center',
    padding: Spacing.two,
  },
});