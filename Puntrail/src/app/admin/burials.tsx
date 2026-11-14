import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDb, listCemeteries, listAllBurials, updateBurialStatus } from '@/lib/db';
import { queueBurialUpdate } from '@/lib/sync/upload';
import type { CachedBurial, BurialStatus } from '@/types';

export default function AdminBurialsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [cemeteryId, setCemeteryId] = useState<string | null>(null);
  const [burials, setBurials] = useState<CachedBurial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const db = await getDb();
      const cemeteries = await listCemeteries(db);
      if (cemeteries.length === 0) {
        Alert.alert('No Data', 'Please download cemetery data from the home screen first.');
        return;
      }

      const activeId = cemeteries[0].id;
      setCemeteryId(activeId);

      const records = await listAllBurials(db, activeId);
      setBurials(records);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load burials.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleStatus = async (burial: CachedBurial) => {
    if (!cemeteryId) return;

    const newStatus: BurialStatus = burial.status === 'verified' ? 'pending' : 'verified';
    
    try {
      const db = await getDb();
      
      // 1. Update local SQLite immediately (Optimistic UI)
      await updateBurialStatus(db, burial.id, newStatus);
      
      // 2. Queue the change for Supabase sync
      await queueBurialUpdate(burial.id, newStatus, burial.version);
      
      // 3. Update UI state
      setBurials((prev) =>
        prev.map((b) => (b.id === burial.id ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <FlatList
        data={burials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No burial records found. Download data first.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleToggleStatus(item)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.name, { color: colors.text }]}>{item.full_name}</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      item.status === 'verified' ? colors.success : colors.warning,
                  },
                ]}>
                <Text style={styles.badgeText}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {item.date_of_burial ? `Buried: ${item.date_of_burial}` : 'Date unknown'}
            </Text>
            <Text style={[styles.hint, { color: colors.primary }]}>
              Tap to toggle status
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
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
  empty: { padding: Spacing.six, alignItems: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center' },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 13 },
  hint: { fontSize: 12, marginTop: Spacing.two, fontWeight: '500' },
});