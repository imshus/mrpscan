import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Pencil, Trash2 } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { invalidateItemCatalogue } from '@/utils/itemCatalogue';
import { deleteItemCode, fetchItemCodes, saveItemCode } from '@/utils/itemCodeApi';

/** One editable line of the sheet; unsaved rows have no id yet. */
interface RowState {
  key: string;
  id: string | null;
  name: string;
  code: string;
  /** Held as typed, so a cleared field stays cleared rather than becoming 0. */
  wastage: string;
  labour: string;
  /** Edited since its last save; the tick, + Add and leaving the screen flush it. */
  dirty?: boolean;
  /** Unlocked by the pencil; the tick saves and locks again. New rows start open. */
  editing?: boolean;
}

let rowKeySeed = 0;
const nextRowKey = () => `row-${rowKeySeed++}`;

const emptyRow = (): RowState => ({
  key: nextRowKey(),
  id: null,
  name: '',
  code: '',
  wastage: '',
  labour: '',
  editing: true,
});

/** A stored figure as it belongs in a text field: absent reads as empty. */
const figureText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export default function ItemCodesScreen() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Shown in the sheet header so a save is visible, not assumed.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  // Rows mid-save, so a slow request cannot double-fire from two blurs.
  const savingKeys = useRef(new Set<string>());
  // Rows edited again while their save was in flight: that edit would
  // otherwise be dropped and never reach the database.
  const resaveKeys = useRef(new Set<string>());
  // The cleanup that saves on leaving the screen reads through this ref,
  // because the closure it was created in holds stale rows.
  // The name field of each row, so the pencil can put the cursor in it.
  const rowsRef = useRef<RowState[]>([]);
  rowsRef.current = rows;
  // Autosave: each keystroke restarts a short timer for that line, so a
  // line saves itself even if its field never blurs.
  const autosaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await fetchItemCodes();
      const loaded = items.map((item) => ({
        key: nextRowKey(),
        id: item.id,
        name: item.description,
        code: item.code,
        wastage: figureText(item.wastage),
        labour: figureText(item.labour),
      }));
      // The sheet always ends with a blank line to type into, like the mockup.
      setRows([...loaded, emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  /** Saves a line once its fields are left; an empty code means "not yet". */
  const persistRow = useCallback(async (row: RowState, quiet = false) => {
    const code = row.code.trim();
    if (!code) return;
    if (savingKeys.current.has(row.key)) {
      // Save again with the newer text once the one in flight answers.
      resaveKeys.current.add(row.key);
      return;
    }
    if (row.id && !row.dirty) return;
    savingKeys.current.add(row.key);
    setSaveState('saving');
    try {
      const saved = await saveItemCode({
        id: row.id ?? undefined,
        code,
        description: row.name.trim(),
        wastage: row.wastage.trim(),
        labour: row.labour.trim(),
      });
      if (saved) {
        updateRow(row.key, {
          id: saved.id,
          code: saved.code,
          name: saved.description,
          wastage: figureText(saved.wastage),
          labour: figureText(saved.labour),
          dirty: false,
        });
      }
      // The scanner names tags from this list; make it fetch the new line.
      invalidateItemCatalogue();
      setSaveState('saved');
    } catch (err) {
      setSaveState('failed');
      if (!quiet) {
        Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not save this item code.');
      }
    } finally {
      savingKeys.current.delete(row.key);
      if (resaveKeys.current.delete(row.key)) {
        const latest = rowsRef.current.find((r) => r.key === row.key);
        if (latest?.dirty) void persistRowRef.current?.(latest, true);
      }
    }
  }, []);

  // persistRow re-runs itself through this ref, which a plain recursive
  // reference inside a useCallback cannot do.
  const persistRowRef = useRef<typeof persistRow | null>(null);
  persistRowRef.current = persistRow;

  /** Restarts the line's autosave timer; it fires 800ms after the last keystroke. */
  const scheduleAutosave = useCallback(
    (key: string) => {
      const timers = autosaveTimers.current;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          const row = rowsRef.current.find((r) => r.key === key);
          if (row) void persistRow(row, true);
        }, 800),
      );
    },
    [persistRow],
  );

  /** Saves every edited line — + Add and leaving the screen both call this. */
  const flushDirtyRows = useCallback(
    (quiet = false) => {
      for (const row of rowsRef.current) {
        if (row.code.trim() && (row.dirty || !row.id)) void persistRow(row, quiet);
      }
    },
    [persistRow],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      // Navigating away must not lose a line whose field never blurred.
      return () => flushDirtyRows(true);
    }, [load, flushDirtyRows]),
  );

  const handleBlur = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (row) void persistRow(row);
  };

  const handleDelete = (row: RowState) => {
    if (!row.id) {
      setRows((current) => {
        const next = current.filter((r) => r.key !== row.key);
        return next.length ? next : [emptyRow()];
      });
      return;
    }
    Alert.alert('Delete item code', `Remove ${row.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteItemCode(row.id as string);
              invalidateItemCatalogue();
              setRows((current) => {
                const next = current.filter((r) => r.key !== row.key);
                return next.length ? next : [emptyRow()];
              });
            } catch (err) {
              Alert.alert('Item Code', err instanceof Error ? err.message : 'Could not delete this item code.');
            }
          })();
        },
      },
    ]);
  };

  const handleAdd = () => {
    flushDirtyRows();
    setRows((current) => [...current, emptyRow()]);
  };

  // The shop's rule for this screen: the pencil unlocks a row, and the tick
  // saves it and locks it again. Nothing saves on its own in between.
  const startEditing = (row: RowState) => updateRow(row.key, { editing: true });
  const submitRow = async (row: RowState) => {
    if (!row.code.trim()) return;
    await persistRow(row);
    const latest = rowsRef.current.find((r) => r.key === row.key);
    if (latest && !latest.dirty) updateRow(row.key, { editing: false });
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Item Code" subtitle="Settings → Masters → Item Code" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={Colors.brandDeep} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              {saveState === 'saving' || saveState === 'failed' ? (
                <Text style={[styles.saveStatus, saveState === 'failed' && styles.saveStatusFailed]}>
                  {saveState === 'saving' ? 'Saving…' : 'Last save failed — check your connection'}
                </Text>
              ) : null}
              <View style={styles.list}>
                {rows.map((row, index) => (
                  <View key={row.key} style={styles.rowCard}>
                    <Text style={styles.rowIndex}>{index + 1}.</Text>

                    <View style={styles.fieldGrid}>
                      <View style={styles.fieldPair}>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>ITEM NAME</Text>
                          <TextInput
                            value={row.name}
                            onChangeText={(text) => {
                              updateRow(row.key, { name: text, dirty: true });
                            }}
                            editable={row.editing === true}
                            style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                          />
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>ITEM CODE</Text>
                          <TextInput
                            value={row.code}
                            onChangeText={(text) => {
                              updateRow(row.key, { code: text.toUpperCase(), dirty: true });
                            }}
                            autoCapitalize="characters"
                            maxLength={40}
                            editable={row.editing === true}
                            style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldPair}>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>WASTAGE</Text>
                          <TextInput
                            value={row.wastage}
                            onChangeText={(text) => {
                              // A percentage: digits and one point, nothing else.
                              const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                              updateRow(row.key, { wastage: cleaned, dirty: true });
                            }}
                            keyboardType="decimal-pad"
                            maxLength={6}
                            editable={row.editing === true}
                            style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                          />
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.fieldLabel}>LABOUR</Text>
                          <TextInput
                            value={row.labour}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                              updateRow(row.key, { labour: cleaned, dirty: true });
                            }}
                            keyboardType="decimal-pad"
                            maxLength={9}
                            editable={row.editing === true}
                            style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.rowActions}>
                      {(() => {
                        const canSubmit = row.editing === true && row.code.trim().length > 0;
                        return (
                          <Pressable
                            onPress={() => void submitRow(row)}
                            disabled={!canSubmit}
                            hitSlop={6}
                            accessibilityLabel="Save this item code"
                            style={[styles.iconBtn, canSubmit ? styles.iconBtnSave : styles.iconBtnDisabled]}
                          >
                            <Check size={15} color={canSubmit ? '#1A8A4A' : Colors.textMuted} strokeWidth={2.5} />
                          </Pressable>
                        );
                      })()}
                      <Pressable
                        onPress={() => startEditing(row)}
                        disabled={row.editing === true}
                        hitSlop={6}
                        accessibilityLabel="Edit this item code"
                        style={[styles.iconBtn, row.editing && styles.iconBtnDisabled]}
                      >
                        <Pencil size={15} color={Colors.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(row)}
                        hitSlop={6}
                        accessibilityLabel="Delete this item code"
                        style={[styles.iconBtn, styles.iconBtnDanger]}
                      >
                        <Trash2 size={15} color={Colors.brandDeep} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.addBtn} onPress={handleAdd}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  saveStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: -4,
  },
  saveStatusFailed: {
    color: Colors.dangerText,
  },
  // The design's .itc-list / .itc-row: each line its own card, 12 apart.
  list: {
    gap: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldGrid: {
    flex: 1,
    gap: 10,
  },
  fieldPair: {
    flexDirection: 'row',
    gap: 10,
  },
  rowActions: {
    gap: 8,
    marginTop: 2,
  },
  rowIndex: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 4,
    minWidth: 16,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  fieldInput: {
    fontSize: 13,
    color: Colors.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    borderStyle: 'dashed',
  },
  // A locked row reads in the muted ink, as the design's read-only field does.
  fieldInputLocked: {
    color: Colors.textMuted,
  },
  // The design's .itc-icon-btn: a 30px circle on the page's alt ground.
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  iconBtnSave: {
    backgroundColor: 'rgba(26,138,74,0.16)',
  },
  iconBtnDanger: {
    backgroundColor: 'rgba(217,41,31,0.1)',
  },
  addBtn: {
    height: 46,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  centerState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.dangerText,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
