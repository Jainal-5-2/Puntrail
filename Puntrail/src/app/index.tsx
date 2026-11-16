import { router } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  Keyboard,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { downloadCemeteryData } from '@/lib/sync/download';
import { downloadOfflineMap, getOfflineMapStatus } from '@/lib/map/offline';
import {
  getDb,
  listCemeteries,
  listPlotsByCemetery,
  listBurialsByPlot,
  searchBurials,
} from '@/lib/db';
import { useAuth } from '@/stores/auth';
import { useNetwork } from '@/stores/network';
import type {
  BurialSearchResult,
  CachedBurial,
  CachedCemetery,
  CachedPlot,
} from '@/types';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;
const DEFAULT_CENTER: [number, number] = [121.9711, 6.7054];
const DEBOUNCE_MS = 300;

export default function MapHomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const { role } = useAuth();
  const { isInternetReachable } = useNetwork();

  // Data state
  const [cemetery, setCemetery] = useState<CachedCemetery | null>(null);
  const [plots, setPlots] = useState<CachedPlot[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BurialSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  // Selection state
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedBurials, setSelectedBurials] = useState<CachedBurial[]>([]);

  // UI state
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingMap, setIsDownloadingMap] = useState(false);
  const [hasOfflineMap, setHasOfflineMap] = useState(false);

  const cameraRef = useRef<CameraRef>(null);
  const hasDownloadedOnLaunch = useRef(false);

  // ── Initial data load ────────────────────────────────────────────────────
  const loadLocalData = useCallback(async () => {
    try {
      const db = await getDb();
      const cemeteries = await listCemeteries(db);
      if (cemeteries.length === 0) {
        setBootError(
          'No cemetery data on this device yet. Connect to the internet to download it.',
        );
        return;
      }

      const active = cemeteries[0];
      setCemetery(active);
      const localPlots = await listPlotsByCemetery(db, active.id);
      setPlots(localPlots);

      const offlineStatus = await getOfflineMapStatus(active.id);
      setHasOfflineMap(offlineStatus);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'Failed to load map data.');
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void loadLocalData();
  }, [loadLocalData]);

  // ── Auto-download from Supabase when online ─────────────────────────────
  useEffect(() => {
    if (!isInternetReachable) return;
    if (hasDownloadedOnLaunch.current) return;

    hasDownloadedOnLaunch.current = true;
    (async () => {
      try {
        await downloadCemeteryData();
        await loadLocalData();
      } catch (err) {
        console.warn('Background download failed:', err);
      }
    })();
  }, [isInternetReachable, loadLocalData]);

  // ── Search debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!cemetery) return;

    const handle = setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const db = await getDb();
        const rows = await searchBurials(db, cemetery.id, trimmed);
        setResults(rows);
      } catch (err) {
        console.warn('Search failed', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, cemetery]);

  // ── Fetch burials when a plot is selected ────────────────────────────────
  useEffect(() => {
    if (!selectedPlotId) {
      setSelectedBurials([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const burials = await listBurialsByPlot(db, selectedPlotId);
        if (!cancelled) setSelectedBurials(burials);
      } catch (err) {
        console.warn('Failed to load burials', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlotId]);

  // ── Fly camera when search result selected ──────────────────────────────
  const flyToPlot = useCallback(
    (plotId: string) => {
      const target = plots.find((p) => p.id === plotId);
      if (!target || !cameraRef.current) return;

      const coords =
        target.geometry.type === 'Polygon'
          ? target.geometry.coordinates[0]
          : target.geometry.coordinates[0][0];

      if (coords.length === 0) return;

      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      cameraRef.current.flyTo({
        center: [
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          (Math.min(...lats) + Math.max(...lats)) / 2,
        ],
        zoom: 19,
        duration: 1000,
      });
    },
    [plots],
  );

  function handleSelectResult(result: BurialSearchResult) {
    setSelectedPlotId(result.plot_id);
    setSearchVisible(false);
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
    flyToPlot(result.plot_id);
  }

  function handlePlotPress(event: NativeSyntheticEvent<PressEventWithFeatures>) {
    const feature = event.nativeEvent.features[0];
    if (!feature) return;
    const id = feature.properties?.plot_id as string | undefined;
    if (!id) return;
    setSelectedPlotId(id === selectedPlotId ? null : id);
  }

  // ── Geojson for plots ───────────────────────────────────────────────────
  const plotGeojson = {
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

  const selectedPlot = plots.find((p) => p.id === selectedPlotId);

  // ── Dev menu actions ────────────────────────────────────────────────────
  async function handleForceDownload() {
    if (!isInternetReachable) {
      Alert.alert('Offline', 'You need internet to download.');
      return;
    }
    setIsDownloading(true);
    try {
      await downloadCemeteryData();
      await loadLocalData();
      Alert.alert('Success', 'Data refreshed from Supabase.');
    } catch (err) {
      Alert.alert('Download failed', err instanceof Error ? err.message : 'Unknown');
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadMap() {
    if (!cemetery) {
      Alert.alert('No Data', 'Download cemetery data first.');
      return;
    }
    setIsDownloadingMap(true);
    try {
      await downloadOfflineMap(cemetery.id);
      setHasOfflineMap(true);
      Alert.alert('Success', 'Offline map cached.');
    } catch (err) {
      Alert.alert('Map Download failed', err instanceof Error ? err.message : 'Unknown');
    } finally {
      setIsDownloadingMap(false);
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────
  if (!MAP_STYLE) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>
          EXPO_PUBLIC_MAPTILER_STYLE_URL missing in .env
        </Text>
      </View>
    );
  }

  if (isBootstrapping) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (bootError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Cannot load map</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{bootError}</Text>
        <Pressable
          onPress={handleForceDownload}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
          {isDownloading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
              Download Data
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE}>
        <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 17 }} />

        <GeoJSONSource id="plots" data={plotGeojson} onPress={handlePlotPress}>
          <Layer
            type="fill"
            id="plots-fill"
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
            id="plots-outline"
            paint={{
              'line-color': '#0969DA',
              'line-width': ['case', ['==', ['get', 'is_selected'], true], 2, 1],
            }}
          />
        </GeoJSONSource>
      </Map>

      {/* Top overlay: search bar + actions */}
      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchVisible(true)}
              placeholder="Search by name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setResults([]);
                }}
                hitSlop={12}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => setShowDevMenu(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Text style={{ color: colors.text, fontSize: 18 }}>⚙</Text>
          </Pressable>
        </View>

        {/* Search results */}
        {searchVisible && query.trim().length > 0 && (
          <View
            style={[
              styles.resultsContainer,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            {results.length === 0 && !isSearching ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No matches. Try a partial name.
              </Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.burial_id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectResult(item)}
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        backgroundColor: pressed
                          ? colors.backgroundSelected
                          : 'transparent',
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.text }]}>
                        {item.full_name}
                      </Text>
                      <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
                        {item.plot_identifier}
                        {item.date_of_burial ? ` · ${item.date_of_burial}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Bottom overlay: selected plot info */}
      {selectedPlot && (
        <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Plot</Text>
              <Pressable onPress={() => setSelectedPlotId(null)} hitSlop={12}>
                <Text style={{ color: colors.textSecondary }}>✕</Text>
              </Pressable>
            </View>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {selectedPlot.plot_identifier}
            </Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {selectedBurials.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No verified burials in this plot.
              </Text>
            ) : (
              selectedBurials.map((b) => (
                <View key={b.id} style={{ marginBottom: Spacing.two }}>
                  <Text style={[styles.burialName, { color: colors.text }]}>
                    {b.full_name}
                  </Text>
                  {b.date_of_burial && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      Buried: {b.date_of_burial}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        </SafeAreaView>
      )}

      {/* Dev menu modal */}
      <Modal
        visible={showDevMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDevMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDevMenu(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + Spacing.four,
              },
            ]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>System</Text>
              <Pressable onPress={() => setShowDevMenu(false)} hitSlop={12}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isInternetReachable ? colors.success : colors.warning },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                {isInternetReachable
                  ? 'Online — data syncs automatically'
                  : 'Offline — showing cached data'}
              </Text>
            </View>

            <Pressable
              onPress={handleForceDownload}
              disabled={isDownloading}
              style={[
                styles.menuBtn,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}>
              {isDownloading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  Force Download Data
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleDownloadMap}
              disabled={isDownloadingMap || !cemetery}
              style={[
                styles.menuBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundElement,
                  opacity: cemetery ? 1 : 0.5,
                },
              ]}>
              {isDownloadingMap ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {hasOfflineMap ? 'Re-download Offline Map' : 'Download Offline Map'}
                </Text>
              )}
            </Pressable>

            {role === 'admin' ? (
              <Pressable
                onPress={() => {
                  setShowDevMenu(false);
                  router.push('/admin');
                }}
                style={[
                  styles.menuBtn,
                  { borderColor: colors.primary, backgroundColor: colors.primary },
                ]}>
                <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
                  Return to Admin Dashboard
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setShowDevMenu(false);
                  router.push('/admin/login');
                }}
                style={[
                  styles.menuBtn,
                  { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Admin Sign In</Text>
              </Pressable>
            )}

            <Text style={[styles.attribution, { color: colors.textSecondary }]}>
              Map data © MapTiler / OpenStreetMap contributors
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
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
    gap: Spacing.three,
  },
  errorTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  resultsContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
    maxHeight: 280,
  },
  resultRow: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultMeta: { fontSize: 12, marginTop: 2 },
  emptyText: { fontSize: 14, fontStyle: 'italic', padding: Spacing.three, textAlign: 'center' },

  // Bottom overlay
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
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 20, fontWeight: '700' },
  divider: { height: 1, marginVertical: Spacing.two },
  burialName: { fontSize: 16, fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13 },
  menuBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  attribution: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});