import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { useState, useRef, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getDb, getCemeteryById, upsertPlot, listPlotsByCemetery } from '@/lib/db';
import { queuePlotCreate, queuePlotUpdate } from '@/lib/sync/upload';
import { runAutoSync } from '@/lib/sync/autoSync';
import type { CachedCemetery, CachedPlot, Plot } from '@/types';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;
const DEFAULT_CENTER: [number, number] = [121.9711, 6.7054];

export default function AdminPlotsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cemeteryId, plotId } = useLocalSearchParams<{ cemeteryId?: string; plotId?: string }>();

  const cameraRef = useRef<CameraRef>(null);
  const [cemetery, setCemetery] = useState<CachedCemetery | null>(null);
  const [backgroundPlots, setBackgroundPlots] = useState<CachedPlot[]>([]);
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [plotIdentifier, setPlotIdentifier] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [existingVersion, setExistingVersion] = useState<number | null>(null);

  // Load cemetery + all plots + existing plot (if editing)
  useEffect(() => {
    (async () => {
      if (!cemeteryId) return;
      const db = await getDb();
      const record = await getCemeteryById(db, cemeteryId);
      if (record) setCemetery(record);

      const localPlots = await listPlotsByCemetery(db, cemeteryId);
      
      // Set background plots (excluding the one we are currently editing)
      setBackgroundPlots(localPlots.filter((p) => p.id !== plotId));

      if (plotId) {
        const existing = localPlots.find((p) => p.id === plotId);
        if (existing) {
          setPlotIdentifier(existing.plot_identifier);
          setExistingVersion(existing.version);

          const coords =
            existing.geometry.type === 'Polygon'
              ? existing.geometry.coordinates[0]
              : existing.geometry.coordinates[0][0];

          // Drop the duplicated closing point
          setVertices(coords.slice(0, -1) as [number, number][]);

          // Fly to the center of the existing polygon
          if (cameraRef.current && coords.length > 0) {
            const lngs = coords.map((c) => c[0]);
            const lats = coords.map((c) => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

            setTimeout(() => {
              cameraRef.current?.flyTo({
                center: [centerLng, centerLat],
                zoom: 19,
                duration: 1000,
              });
            }, 500);
          }
        }
      }
    })();
  }, [cemeteryId, plotId]);

  const handleMapPress = (event: any) => {
    Keyboard.dismiss();
    const lngLat = event?.nativeEvent?.lngLat;
    if (Array.isArray(lngLat) && lngLat.length === 2) {
      setVertices((prev) => [...prev, lngLat as [number, number]]);
    }
  };

  const handleUndo = () => {
    setVertices((prev) => prev.slice(0, -1));
  };

  // GeoJSON for existing plots to show as background
  const backgroundGeojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: backgroundPlots.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, identifier: p.plot_identifier },
        geometry: p.geometry,
      })),
    } as GeoJSON.FeatureCollection;
  }, [backgroundPlots]);

  const previewGeojson = useMemo(() => {
    if (vertices.length < 3) {
      return { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
    }
    const closedPolygon = [...vertices, vertices[0]];
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [closedPolygon] },
        },
      ],
    } as GeoJSON.FeatureCollection;
  }, [vertices]);

  const lineGeojson = useMemo(() => {
    if (vertices.length < 2) {
      return { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: vertices },
        },
      ],
    } as GeoJSON.FeatureCollection;
  }, [vertices]);

  const verticesGeojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: vertices.map((coord, index) => ({
        type: 'Feature',
        properties: { index },
        geometry: { type: 'Point', coordinates: coord },
      })),
    } as GeoJSON.FeatureCollection;
  }, [vertices]);

  const handleSave = async () => {
    if (!cemeteryId) {
      Alert.alert('Error', 'No cemetery selected.');
      return;
    }
    if (vertices.length < 3) {
      Alert.alert('Error', 'A polygon must have at least 3 vertices.');
      return;
    }
    if (!plotIdentifier.trim()) {
      Alert.alert('Error', 'Please enter a plot identifier (e.g., A-001).');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const closedPolygon = [...vertices, vertices[0]];
      const now = new Date().toISOString();
      const targetId = plotId || Crypto.randomUUID();

      const newPlot: Plot = {
        id: targetId,
        cemetery_id: cemeteryId,
        section_id: null,
        plot_identifier: plotIdentifier.trim(),
        geometry: { type: 'Polygon', coordinates: [closedPolygon] },
        geometry_source: 'survey',
        geometry_verified: true,
        version: existingVersion || 1,
        created_at: now,
        updated_at: now,
      };

      await db.withTransactionAsync(async () => {
        await upsertPlot(db, newPlot);
        if (plotId && existingVersion) {
          await queuePlotUpdate(targetId, newPlot, existingVersion);
        } else {
          await queuePlotCreate(targetId, newPlot.geometry, newPlot.plot_identifier);
        }
      });

      void runAutoSync();
      Alert.alert('Success', plotId ? 'Plot updated.' : 'Plot saved and queued for sync.');
      router.back();
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!MAP_STYLE) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>Map style URL missing in .env</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Map style={styles.map} mapStyle={MAP_STYLE} onPress={handleMapPress}>
        <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 19 }} />

        {/* Background Existing Plots */}
        <GeoJSONSource id="background-plots" data={backgroundGeojson}>
          <Layer
            type="fill"
            id="background-fill"
            paint={{ 'fill-color': '#8B949E', 'fill-opacity': 0.2 }}
          />
          <Layer
            type="line"
            id="background-outline"
            paint={{ 'line-color': '#8B949E', 'line-width': 1 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="line" data={lineGeojson}>
          <Layer type="line" id="draw-line" paint={{ 'line-color': '#2F81F7', 'line-width': 2 }} />
        </GeoJSONSource>

        <GeoJSONSource id="preview" data={previewGeojson}>
          <Layer
            type="fill"
            id="preview-fill"
            paint={{ 'fill-color': '#2F81F7', 'fill-opacity': 0.4 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="vertices" data={verticesGeojson}>
          <Layer
            type="circle"
            id="vertices-circle"
            paint={{
              'circle-radius': 6,
              'circle-color': '#fff',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#2F81F7',
            }}
          />
        </GeoJSONSource>
      </Map>

      <View style={[styles.overlay, { bottom: 0, paddingBottom: insets.bottom }]} pointerEvents="box-none">
        <View style={[styles.panel, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {plotId ? 'Edit Plot' : 'Draw Plot'}
            {cemetery ? ` in ${cemetery.name}` : ''} ({vertices.length} pts)
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap the map to place vertices. Minimum 3 points.
          </Text>

          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
            ]}
            placeholder="Plot Identifier (e.g., A-002)"
            placeholderTextColor={colors.textSecondary}
            value={plotIdentifier}
            onChangeText={setPlotIdentifier}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={handleUndo}
              disabled={vertices.length === 0}
              style={[
                styles.button,
                {
                  backgroundColor: colors.backgroundSelected,
                  opacity: vertices.length === 0 ? 0.5 : 1,
                },
              ]}>
              <Text style={{ color: colors.text }}>Undo</Text>
            </Pressable>
            <Pressable
              onPress={() => setVertices([])}
              disabled={vertices.length === 0}
              style={[
                styles.button,
                {
                  backgroundColor: colors.backgroundSelected,
                  opacity: vertices.length === 0 ? 0.5 : 1,
                },
              ]}>
              <Text style={{ color: colors.text }}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.button, { backgroundColor: colors.primary }]}>
              {isSaving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={{ color: colors.primaryText }}>
                  {plotId ? 'Update' : 'Save'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  panel: {
    margin: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  button: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});