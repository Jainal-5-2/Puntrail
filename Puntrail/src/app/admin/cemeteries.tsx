import { useEffect, useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDb, listCemeteries, upsertCemetery } from '@/lib/db';
import { queueCemeteryCreate } from '@/lib/sync/upload';
import type { CachedCemetery, Cemetery } from '@/types';

export default function AdminCemeteriesScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cemeteries, setCemeteries] = useState<CachedCemetery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDb();
      const records = await listCemeteries(db);
      setCemeteries(records);
    } catch (err) {
      Alert.alert('Error', 'Failed to load cemeteries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert('Error', 'Name and location are required.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const newId = Crypto.randomUUID();

      const newCemetery: Cemetery = {
        id: newId,
        name: name.trim(),
        location: location.trim(),
        boundary: null,
        notes: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await upsertCemetery(db, newCemetery);
      await queueCemeteryCreate(newId, newCemetery);

      setName('');
      setLocation('');
      setIsAdding(false);
      await loadData();

      Alert.alert('Success', 'Cemetery created locally and queued for sync.');
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={cemeteries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.headerContainer}>
                <View style={styles.headerRow}>
                  <Text style={[styles.title, { color: colors.text }]}>Cemeteries</Text>
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsAdding(!isAdding);
                    }}
                    style={[styles.addButton, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
                      {isAdding ? 'Cancel' : '+ Add New'}
                    </Text>
                  </Pressable>
                </View>

                {isAdding && (
                  <View
                    style={[
                      styles.formCard,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    ]}>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Cemetery Name"
                      placeholderTextColor={colors.textSecondary}
                      value={name}
                      onChangeText={setName}
                    />
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Location (e.g., Isabela City)"
                      placeholderTextColor={colors.textSecondary}
                      value={location}
                      onChangeText={setLocation}
                    />
                    <Pressable
                      onPress={handleSave}
                      disabled={isSaving}
                      style={[styles.saveButton, { backgroundColor: colors.primary }]}>
                      {isSaving ? (
                        <ActivityIndicator color={colors.primaryText} />
                      ) : (
                        <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
                          Save Cemetery
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No cemeteries found.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/admin/cemetery/[id]',
                    params: { id: item.id },
                  })
                }
                android_ripple={{ color: colors.backgroundSelected }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {item.location}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  Tap to manage plots and details
                </Text>
              </Pressable>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
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
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700' },
  addButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  saveButton: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  empty: { padding: Spacing.six, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  card: {
    padding: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardSubtitle: { fontSize: 14 },
  cardMeta: { fontSize: 12, marginTop: Spacing.two, fontStyle: 'italic' },
});