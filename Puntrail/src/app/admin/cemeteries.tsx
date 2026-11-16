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
import { getDb, listCemeteries, upsertCemetery, deleteCemetery } from '@/lib/db';
import { 
  queueCemeteryCreate, 
  queueCemeteryUpdate, 
  queueCemeteryDelete 
} from '@/lib/sync/upload';
import { runAutoSync } from '@/lib/sync/autoSync';
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
  const [editingCemetery, setEditingCemetery] = useState<CachedCemetery | null>(null);

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

  const resetForm = () => {
    setName('');
    setLocation('');
    setIsAdding(false);
    setEditingCemetery(null);
  };

  const handleEditClick = (cemetery: CachedCemetery) => {
    setName(cemetery.name);
    setLocation(cemetery.location);
    setEditingCemetery(cemetery);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert('Error', 'Name and location are required.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      if (editingCemetery) {
        // ── Update ──
        const updated: Cemetery = {
          id: editingCemetery.id,
          name: name.trim(),
          location: location.trim(),
          boundary: editingCemetery.boundary,
          notes: editingCemetery.notes,
          version: editingCemetery.version,
          created_at: now,
          updated_at: now,
        };

        await db.withTransactionAsync(async () => {
          await upsertCemetery(db, updated);
          await queueCemeteryUpdate(editingCemetery.id, updated, editingCemetery.version);
        });
      } else {
        // ── Create ──
        const newId = Crypto.randomUUID();
        const newCemetery: Cemetery = {
          id: newId,
          name: name.trim(),
          location: location.trim(),
          boundary: null,
          notes: null,
          version: 1,
          created_at: now,
          updated_at: now,
        };

        await db.withTransactionAsync(async () => {
          await upsertCemetery(db, newCemetery);
          await queueCemeteryCreate(newId, newCemetery);
        });
      }

      resetForm();
      await loadData();
      void runAutoSync();
      Alert.alert('Success', editingCemetery ? 'Cemetery updated.' : 'Cemetery created.');
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (cemetery: CachedCemetery) => {
    Alert.alert(
      'Delete cemetery?',
      `Remove "${cemetery.name}"? Any plots inside it will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDb();
              await db.withTransactionAsync(async () => {
                await deleteCemetery(db, cemetery.id);
                await queueCemeteryDelete(cemetery.id, cemetery.version);
              });
              setCemeteries((prev) => prev.filter((c) => c.id !== cemetery.id));
              void runAutoSync();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error');
            }
          },
        },
      ]
    );
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
                      if (isAdding) {
                        resetForm();
                      } else {
                        setIsAdding(true);
                      }
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
                          {editingCemetery ? 'Update Cemetery' : 'Save Cemetery'}
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
                
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => handleEditClick(item)}
                    hitSlop={8}
                    style={styles.actionBtn}>
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    hitSlop={8}
                    style={styles.actionBtn}>
                    <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
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
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  actionBtn: { paddingVertical: 2 },
});