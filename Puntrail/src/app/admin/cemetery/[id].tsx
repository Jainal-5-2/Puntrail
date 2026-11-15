import { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDb, getCemeteryById, listPlotsByCemetery } from '@/lib/db';
import type { CachedCemetery, CachedPlot } from '@/types';

export default function CemeteryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cemetery, setCemetery] = useState<CachedCemetery | null>(null);
  const [plots, setPlots] = useState<CachedPlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const db = await getDb();
      const record = await getCemeteryById(db, id);
      if (!record) {
        Alert.alert('Error', 'Cemetery not found.');
        router.back();
        return;
      }
      setCemetery(record);
      const localPlots = await listPlotsByCemetery(db, id);
      setPlots(localPlots);
    } catch (err) {
      Alert.alert('Error', 'Failed to load cemetery details.');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!cemetery) return null;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={plots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>{cemetery.name}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {cemetery.location}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push({ pathname: '/admin/plots', params: { cemeteryId: id } })
              }
              style={[styles.addButton, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryText, fontWeight: '600' }}>+ Add Plot</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Plots ({plots.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No plots mapped yet. Tap "+ Add Plot" to draw one on the map.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.plot_identifier}
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: item.geometry_verified ? colors.success : colors.warning,
                  },
                ]}>
                <Text style={styles.badgeText}>
                  {item.geometry_verified ? 'VERIFIED' : 'UNVERIFIED'}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              Source: {item.geometry_source} | Version: {item.version}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: {
    padding: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
  headerContainer: {
    marginBottom: Spacing.four,
    gap: Spacing.four,
  },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, marginTop: Spacing.one },
  addButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: { padding: Spacing.six, alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  card: {
    padding: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardMeta: { fontSize: 12, fontStyle: 'italic' },
});