import { useCallback, useState } from 'react';
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
import { Colors, Spacing } from '@/constants/theme';
import { invalidateWastageCodes } from '@/components/scanner/WastageSection';
import { deleteWastageCode, fetchWastageCodes, saveWastageCode } from '@/utils/wastageCodeApi';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

/** One line of the list; unsaved lines have no id yet. */
interface RowState {
  key: string;
  id: string | null;
  code: string;
  /** Held as typed, so a cleared field stays cleared rather than becoming 0. */
  percent: string;
  /** Unlocked: the check saves it. Locked: the pencil unlocks it. */
  editing: boolean;
  saving?: boolean;
}

let rowKeySeed = 0;
const nextRowKey = () => `wastage-${rowKeySeed++}`;

const emptyRow = (): RowState => ({ key: nextRowKey(), id: null, code: '', percent: '', editing: true });

const percentText = (value: number | null) => (value === null ? '' : String(value));

/**
 * Masters → Wastage, to the shop's design: each wastage code a card of its
 * own — code and percentage side by side — with a green check beside it.
 * The check saves the line and turns into a pencil; the pencil unlocks the
 * line again and turns back into the check. The bin removes the line.
 */
export default function WastageScreen() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const saved = await fetchWastageCodes();
      const loaded: RowState[] = saved.map((row) => ({
        key: nextRowKey(),
        id: row.id,
        code: row.code,
        percent: percentText(row.percent),
        editing: false,
      }));
      setRows(loaded.length ? loaded : [emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wastage codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submitRow = async (row: RowState) => {
    if (row.saving) return;
    const code = row.code.trim();
    if (!code) {
      Alert.alert('Wastage', 'Enter the wastage code first.');
      return;
    }
    const percent = row.percent.trim();
    if (percent && (Number(percent) < 0 || Number(percent) > 100)) {
      Alert.alert('Wastage', 'Wastage must be a percentage between 0 and 100.');
      return;
    }
    updateRow(row.key, { saving: true });
    try {
      const saved = await saveWastageCode({ id: row.id ?? undefined, code, percent });
      // The scan screen's dropdown reads the list afresh next time.
      invalidateWastageCodes();
      updateRow(row.key, {
        id: saved?.id ?? row.id,
        code: saved?.code ?? code.toUpperCase(),
        percent: saved ? percentText(saved.percent) : percent,
        editing: false,
        saving: false,
      });
    } catch (err) {
      updateRow(row.key, { saving: false });
      Alert.alert('Wastage', err instanceof Error ? err.message : 'Could not save this wastage code.');
    }
  };

  const removeRow = (row: RowState) => {
    const drop = () =>
      setRows((current) => {
        const next = current.filter((r) => r.key !== row.key);
        return next.length ? next : [emptyRow()];
      });
    if (!row.id) {
      drop();
      return;
    }
    Alert.alert('Delete wastage code', `Remove ${row.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteWastageCode(row.id as string);
              invalidateWastageCodes();
              drop();
            } catch (err) {
              Alert.alert('Wastage', err instanceof Error ? err.message : 'Could not delete this wastage code.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Wastage" subtitle="Settings → Masters → Wastage" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <KeyboardAwareScrollView
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
              <View style={styles.list}>
                {rows.map((row, index) => (
                  <View key={row.key} style={styles.rowCard}>
                    <Text style={styles.rowIndex}>{index + 1}.</Text>

                    <View style={styles.fieldPair}>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Wastage Code</Text>
                        <TextInput
                          value={row.code}
                          onChangeText={(text) => updateRow(row.key, { code: text.toUpperCase() })}
                          autoCapitalize="characters"
                          maxLength={40}
                          editable={row.editing}
                          style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Wastage %</Text>
                        <TextInput
                          value={row.percent}
                          onChangeText={(text) =>
                            updateRow(row.key, {
                              // A percentage: digits and one point, nothing else.
                              percent: text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'),
                            })
                          }
                          keyboardType="decimal-pad"
                          maxLength={6}
                          editable={row.editing}
                          style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                        />
                      </View>
                    </View>

                    <View style={styles.rowActions}>
                      {row.editing ? (
                        <Pressable
                          onPress={() => void submitRow(row)}
                          disabled={row.saving}
                          hitSlop={6}
                          accessibilityLabel="Save this wastage code"
                          style={[styles.iconBtn, styles.iconBtnSave, row.saving && styles.iconBtnBusy]}
                        >
                          {row.saving ? (
                            <ActivityIndicator size="small" color="#1A8A4A" />
                          ) : (
                            <Check size={16} color="#1A8A4A" strokeWidth={2.6} />
                          )}
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => updateRow(row.key, { editing: true })}
                          hitSlop={6}
                          accessibilityLabel="Edit this wastage code"
                          style={styles.iconBtn}
                        >
                          <Pencil size={15} color={Colors.textMuted} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removeRow(row)}
                        hitSlop={6}
                        accessibilityLabel="Delete this wastage code"
                        style={[styles.iconBtn, styles.iconBtnDanger]}
                      >
                        <Trash2 size={15} color={Colors.brandDeep} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.addBtn}
                onPress={() => setRows((current) => [...current, emptyRow()])}
              >
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </>
          )}
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  list: { gap: 12 },
  // The design's card: white, a hairline border, 14 round.
  rowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIndex: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 4,
    minWidth: 18,
  },
  fieldPair: { flex: 1, flexDirection: 'row', gap: 14, marginTop: 4 },
  field: { flex: 1 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
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
  fieldInputLocked: { color: Colors.textMuted },
  rowActions: { gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSave: { backgroundColor: 'rgba(26,138,74,0.16)' },
  iconBtnBusy: { opacity: 0.6 },
  iconBtnDanger: { backgroundColor: 'rgba(217,41,31,0.1)' },
  addBtn: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 15, fontWeight: '800', color: Colors.brandDeep },
  centerState: { paddingVertical: 32, alignItems: 'center' },
  errorText: { fontSize: 13, color: Colors.dangerText, paddingVertical: 16 },
});
