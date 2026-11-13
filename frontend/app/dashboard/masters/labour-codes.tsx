import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
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
import { invalidateLabourCodes } from '@/components/scanner/LaborSection';
import { deleteLabourCode, fetchLabourCodes, saveLabourCode } from '@/utils/labourCodeApi';
import {
  cleanLabourCodeRate,
  DEFAULT_LABOUR_CODE_UNIT,
  LABOUR_CODE_MAX_LENGTH,
  LABOUR_CODE_UNITS,
  labourCodeLineError,
  type LabourCodeUnit,
} from '@/utils/labourCodes';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

/** One line of the list; unsaved lines have no id yet. */
interface RowState {
  key: string;
  id: string | null;
  code: string;
  /** Held as typed, so a cleared field stays cleared rather than becoming 0. */
  rate: string;
  /** What the rate is in; picking the code on a scan charges it in this unit. */
  unit: LabourCodeUnit;
  /** Unlocked: the check saves it. Locked: the pencil unlocks it. */
  editing: boolean;
  saving?: boolean;
}

let rowKeySeed = 0;
const nextRowKey = () => `labour-code-${rowKeySeed++}`;

const emptyRow = (): RowState => ({
  key: nextRowKey(),
  id: null,
  code: '',
  rate: '',
  unit: DEFAULT_LABOUR_CODE_UNIT,
  editing: true,
});

const rateText = (value: number | null) => (value === null ? '' : String(value));

/** How each unit reads on its chip; a tap moves to the next (as on Item Code). */
const UNIT_LABELS: Record<LabourCodeUnit, string> = {
  'Per Gram': '₹/g',
  'Per 10 Gram': '₹/10g',
  Percent: '% of gold',
};
const nextUnit = (unit: LabourCodeUnit): LabourCodeUnit =>
  LABOUR_CODE_UNITS[(LABOUR_CODE_UNITS.indexOf(unit) + 1) % LABOUR_CODE_UNITS.length];

/**
 * Masters → Labour Code, built like Masters → Wastage: each labour code a
 * card of its own — code and rate side by side, the rate's unit on a chip
 * beside its label — with a green check beside it. The check saves the line
 * and turns into a pencil; the pencil unlocks the line again and turns back
 * into the check. The bin removes the line. On a scan, picking a code fills
 * the Labour Charge tile's Labour Rate with its rate.
 */
export default function LabourCodesScreen() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const saved = await fetchLabourCodes();
      const loaded: RowState[] = saved.map((row) => ({
        key: nextRowKey(),
        id: row.id,
        code: row.code,
        rate: rateText(row.rate),
        unit: row.unit,
        editing: false,
      }));
      setRows(loaded.length ? loaded : [emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labour codes.');
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
    const rate = row.rate.trim();
    const problem = labourCodeLineError(code, rate, row.unit);
    if (problem) {
      Alert.alert('Labour Code', problem);
      return;
    }
    updateRow(row.key, { saving: true });
    try {
      const saved = await saveLabourCode({ id: row.id ?? undefined, code, rate, unit: row.unit });
      // The scan screen's dropdown reads the list afresh next time.
      invalidateLabourCodes();
      updateRow(row.key, {
        id: saved?.id ?? row.id,
        code: saved?.code ?? code.toUpperCase(),
        rate: saved ? rateText(saved.rate) : rate,
        unit: saved?.unit ?? row.unit,
        editing: false,
        saving: false,
      });
    } catch (err) {
      updateRow(row.key, { saving: false });
      Alert.alert('Labour Code', err instanceof Error ? err.message : 'Could not save this labour code.');
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
    Alert.alert('Delete labour code', `Remove ${row.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteLabourCode(row.id as string);
              invalidateLabourCodes();
              drop();
            } catch (err) {
              Alert.alert('Labour Code', err instanceof Error ? err.message : 'Could not delete this labour code.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Labour Code" subtitle="Settings → Masters → Labour Code" />
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
                        <Text style={styles.fieldLabel}>Labour Code</Text>
                        <TextInput
                          value={row.code}
                          onChangeText={(text) => updateRow(row.key, { code: text.toUpperCase() })}
                          autoCapitalize="characters"
                          maxLength={LABOUR_CODE_MAX_LENGTH}
                          editable={row.editing}
                          style={[styles.fieldInput, !row.editing && styles.fieldInputLocked]}
                        />
                      </View>
                      <View style={styles.field}>
                        <View style={styles.labelRow}>
                          <Text style={styles.fieldLabel}>Labour Rate</Text>
                          {/* The unit the rate is in: per gram, per 10 g or a
                              percent of the gold value. A tap moves to the
                              next while the line is open. */}
                          <Pressable
                            onPress={() => updateRow(row.key, { unit: nextUnit(row.unit) })}
                            disabled={!row.editing}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Labour rate unit: ${UNIT_LABELS[row.unit]}`}
                            style={styles.unitChip}
                          >
                            <Text style={styles.unitChipText}>{UNIT_LABELS[row.unit]}</Text>
                          </Pressable>
                        </View>
                        <TextInput
                          value={row.rate}
                          onChangeText={(text) => updateRow(row.key, { rate: cleanLabourCodeRate(text) })}
                          keyboardType="decimal-pad"
                          maxLength={9}
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
                          accessibilityLabel="Save this labour code"
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
                          accessibilityLabel="Edit this labour code"
                          style={styles.iconBtn}
                        >
                          <Pencil size={15} color={Colors.textMuted} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removeRow(row)}
                        hitSlop={6}
                        accessibilityLabel="Delete this labour code"
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
  // The design's card: white, a hairline border, 14 round (as on Wastage).
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brandDeep,
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
