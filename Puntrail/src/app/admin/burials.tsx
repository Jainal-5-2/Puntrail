import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getDb,
  listCemeteries,
  listAllBurials,
  listPlotsByCemetery,
  createBurial,
  upsertBurial,
  deleteBurial,
} from '@/lib/db';
import {
  queueBurialCreate,
  queueBurialUpdate,
  queueBurialDelete,
} from '@/lib/sync/upload';
import type { CachedBurial, CachedPlot, Burial, BurialStatus } from '@/types';

type ThemeColors = typeof Colors.light | typeof Colors.dark;

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; burial: CachedBurial };

export default function AdminBurialsScreen() {
  const scheme = useColorScheme();
  const colors: ThemeColors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [cemeteryId, setCemeteryId] = useState<string | null>(null);
  const [plots, setPlots] = useState<CachedPlot[]>([]);
  const [burials, setBurials] = useState<CachedBurial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });

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

      const [records, localPlots] = await Promise.all([
        listAllBurials(db, activeId),
        listPlotsByCemetery(db, activeId),
      ]);
      setBurials(records);
      setPlots(localPlots);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load burials.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = (burial: CachedBurial) => {
    Alert.alert(
      'Delete burial?',
      `Remove "${burial.full_name}" permanently? This will be queued for sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDb();
              await db.withTransactionAsync(async () => {
                await deleteBurial(db, burial.id);
                await queueBurialDelete(burial.id, burial.version);
              });
              setBurials((prev) => prev.filter((b) => b.id !== burial.id));
            } catch (err) {
              Alert.alert(
                'Delete failed',
                err instanceof Error ? err.message : 'Unknown error',
              );
            }
          },
        },
      ],
    );
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
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
              {burials.length} record{burials.length === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() => setEditor({ mode: 'create' })}
              disabled={plots.length === 0}
              style={[
                styles.addButton,
                {
                  backgroundColor:
                    plots.length === 0 ? colors.backgroundSelected : colors.primary,
                },
              ]}>
              <Text
                style={{
                  color:
                    plots.length === 0 ? colors.textSecondary : colors.primaryText,
                  fontWeight: '600',
                }}>
                + Add Burial
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No burial records found. Tap "+ Add Burial" to create one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditor({ mode: 'edit', burial: item })}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed
                  ? colors.backgroundSelected
                  : colors.backgroundElement,
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
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {item.date_of_burial ? `Buried: ${item.date_of_burial}` : 'Date unknown'}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => setEditor({ mode: 'edit', burial: item })}
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

      <BurialEditorModal
        state={editor}
        cemeteryId={cemeteryId}
        plots={plots}
        colors={colors}
        onClose={() => setEditor({ mode: 'closed' })}
        onSaved={(updated) =>
          setBurials((prev) => {
            const exists = prev.some((b) => b.id === updated.id);
            return exists
              ? prev.map((b) => (b.id === updated.id ? updated : b))
              : [...prev, updated].sort((a, b) =>
                  a.full_name.localeCompare(b.full_name),
                );
          })
        }
      />
    </SafeAreaView>
  );
}

function BurialEditorModal({
  state,
  cemeteryId,
  plots,
  colors,
  onClose,
  onSaved,
}: {
  state: EditorState;
  cemeteryId: string | null;
  plots: CachedPlot[];
  colors: ThemeColors;
  onClose: () => void;
  onSaved: (burial: CachedBurial) => void;
}) {
  const visible = state.mode !== 'closed';
  const editing = state.mode === 'edit' ? state.burial : null;
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [plotId, setPlotId] = useState<string | null>(null);
  const [ageAtDeath, setAgeAtDeath] = useState('');
  const [status, setStatus] = useState<BurialStatus>('pending');
  const [isSaving, setIsSaving] = useState(false);

  const [dateOfDeath, setDateOfDeath] = useState<Date | null>(null);
  const [dateOfBurial, setDateOfBurial] = useState<Date | null>(null);

  const [showDeathPicker, setShowDeathPicker] = useState(false);
  const [showBurialPicker, setShowBurialPicker] = useState(false);

  useEffect(() => {
    if (state.mode === 'create') {
      setFullName('');
      setPlotId(plots[0]?.id ?? null);
      setAgeAtDeath('');
      setStatus('pending');
      setDateOfDeath(null);
      setDateOfBurial(new Date());
    } else if (state.mode === 'edit') {
      const b = state.burial;
      setFullName(b.full_name);
      setPlotId(b.plot_id);
      setAgeAtDeath(b.age_at_death ?? '');
      setStatus(b.status);
      
      setDateOfDeath(b.date_of_death ? new Date(b.date_of_death) : null);
      setDateOfBurial(b.date_of_burial ? new Date(b.date_of_burial) : null);
    }
  }, [state, plots]);

  const formatDateForDB = (date: Date | null) => {
    if (!date) return null;
    return date.toISOString().split('T')[0];
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return 'Select date...';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  async function handleSave() {
    if (!cemeteryId) return;
    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter the full name.');
      return;
    }
    if (!plotId) {
      Alert.alert('Missing plot', 'Please select a plot.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const now = new Date().toISOString();

      const dbDateDeath = formatDateForDB(dateOfDeath);
      const dbDateBurial = formatDateForDB(dateOfBurial);

      if (editing) {
        const updated: Burial = {
          id: editing.id,
          plot_id: plotId,
          full_name: fullName.trim(),
          name_normalized: null,
          date_of_death: dbDateDeath,
          date_of_burial: dbDateBurial,
          age_at_death: ageAtDeath.trim() || null,
          status,
          version: editing.version,
          created_at: now,
          updated_at: now,
        };

        await db.withTransactionAsync(async () => {
          await upsertBurial(db, updated);
          await queueBurialUpdate(editing.id, status, editing.version);
        });

        onSaved({
          id: updated.id,
          plot_id: updated.plot_id,
          full_name: updated.full_name,
          name_normalized: null,
          date_of_death: updated.date_of_death,
          date_of_burial: updated.date_of_burial,
          age_at_death: updated.age_at_death,
          status: updated.status,
          version: updated.version,
          synced_at: now,
        });
      } else {
        const newId = Crypto.randomUUID();
        const created: Burial = {
          id: newId,
          plot_id: plotId,
          full_name: fullName.trim(),
          name_normalized: null,
          date_of_death: dbDateDeath,
          date_of_burial: dbDateBurial,
          age_at_death: ageAtDeath.trim() || null,
          status,
          version: 1,
          created_at: now,
          updated_at: now,
        };

        await db.withTransactionAsync(async () => {
          await createBurial(db, created);
          await queueBurialCreate(newId, created);
        });

        onSaved({
          id: created.id,
          plot_id: created.plot_id,
          full_name: created.full_name,
          name_normalized: null,
          date_of_death: created.date_of_death,
          date_of_burial: created.date_of_burial,
          age_at_death: created.age_at_death,
          status: created.status,
          version: created.version,
          synced_at: now,
        });
      }

      onClose();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, Spacing.four),
            },
          ]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {editing ? 'Edit Burial' : 'New Burial'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            <Field label="Full Name" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g., Juan Dela Cruz"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />
            </Field>

            <Field label="Plot" colors={colors}>
              <View style={styles.chipRow}>
                {plots.map((p) => {
                  const active = p.id === plotId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPlotId(p.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.backgroundElement,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}>
                        {p.plot_identifier}
                      </Text>
                    </Pressable>
                  );
                })}
                {plots.length === 0 && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    No plots available. Create a plot first.
                  </Text>
                )}
              </View>
            </Field>

            <Field label="Date of Death" colors={colors}>
              <Pressable
                onPress={() => setShowDeathPicker(true)}
                style={[styles.input, styles.datePickerButton, { borderColor: colors.border }]}>
                <Text style={{ color: dateOfDeath ? colors.text : colors.textSecondary }}>
                  {formatDateForDisplay(dateOfDeath)}
                </Text>
              </Pressable>
            </Field>

            <Field label="Date of Burial" colors={colors}>
              <Pressable
                onPress={() => setShowBurialPicker(true)}
                style={[styles.input, styles.datePickerButton, { borderColor: colors.border }]}>
                <Text style={{ color: dateOfBurial ? colors.text : colors.textSecondary }}>
                  {formatDateForDisplay(dateOfBurial)}
                </Text>
              </Pressable>
            </Field>

            <Field label="Age at Death" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={ageAtDeath}
                onChangeText={setAgeAtDeath}
                placeholder="Optional"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </Field>

            <Field label="Status" colors={colors}>
              <View style={styles.chipRow}>
                {(['verified', 'pending'] as BurialStatus[]).map((s) => {
                  const active = s === status;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.backgroundElement,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? colors.primaryText : colors.text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}>
                        {s.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Pressable
              onPress={handleSave}
              disabled={isSaving || plots.length === 0}
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    isSaving || plots.length === 0
                      ? colors.backgroundSelected
                      : colors.primary,
                },
              ]}>
              {isSaving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text
                  style={{
                    color:
                      plots.length === 0 ? colors.textSecondary : colors.primaryText,
                    fontWeight: '600',
                    fontSize: 16,
                  }}>
                  {editing ? 'Save Changes' : 'Create Burial'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Android pickers show as dialogs, iOS pickers show inline (or as a modal). 
          We conditionally render them right at the bottom of the Modal. */}
      {showDeathPicker && (
        <DateTimePicker
          value={dateOfDeath || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDeathPicker(false);
            if (event.type === 'set' && selectedDate) {
              setDateOfDeath(selectedDate);
            }
          }}
        />
      )}

      {showBurialPicker && (
        <DateTimePicker
          value={dateOfBurial || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowBurialPicker(false);
            if (event.type === 'set' && selectedDate) {
              setDateOfBurial(selectedDate);
            }
          }}
        />
      )}
    </Modal>
  );
}

function Field({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  headerCount: { fontSize: 13 },
  addButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
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
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  actionBtn: { paddingVertical: 2 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  sheetContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  field: { gap: Spacing.one },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    minHeight: 48,
  },
  datePickerButton: {
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    marginTop: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});