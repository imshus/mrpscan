import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, Plus } from 'lucide-react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { screenStyles } from '@/constants/screenLayout';
import type { ActiveFormula } from '@/store/formulaStore';
import type { Formula2Row } from '@/types/formulaSettings';
import type { FormulaSettings } from '@/types/formulaSettings';
import {
  applyFormulaSettingsToStore,
  fetchFormulaSettings,
  formula2RulesToRows,
  updateFormulaSettings,
} from '@/utils/formulaSettingsApi';

import {
  getKaratOptionsForAdd,
  getKaratOptionsForEdit,
} from '@/utils/formulaUtils';

const BUTTON_GREEN = '#A81F17';

interface FormulaOptionBlockProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function FormulaOptionBlock({ label, isActive, onSelect, children }: FormulaOptionBlockProps) {
  return (
    <View style={styles.formulaOptionRow}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
        style={styles.radioOuter}
      >
        {isActive ? <View style={styles.radioInner} /> : null}
      </Pressable>
      <Pressable
        onPress={onSelect}
        style={[styles.formulaCard, isActive && styles.formulaCardActive]}
      >
        <Text style={[styles.formulaCardLabel, isActive && styles.formulaCardLabelActive]}>
          {label}
        </Text>
        {children}
      </Pressable>
    </View>
  );
}

interface Formula2RowItemProps {
  row: Formula2Row;
  allRows: Formula2Row[];
  showDelete: boolean;
  onSave: (karat: string) => void;
  onRequestDelete: () => void;
}

function Formula2RowItem({
  row,
  allRows,
  showDelete,
  onSave,
  onRequestDelete,
}: Formula2RowItemProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingKarat, setPendingKarat] = useState(row.karat);
  const isDirty = pendingKarat !== row.karat;

  useEffect(() => {
    setPendingKarat(row.karat);
  }, [row.karat]);

  const rowIndex = allRows.findIndex((item) => item.id === row.id);
  const karatOptions = getKaratOptionsForEdit(
    allRows.map((item) => item.karat),
    rowIndex,
  );

  const handleDeletePress = () => {
    setDropdownOpen(false);
    onRequestDelete();
  };

  return (
    <View style={[
      styles.f2Row, 
      { zIndex: 1000 - rowIndex },
      dropdownOpen && { marginBottom: karatOptions.length * 38 }
    ]}>
      <View style={styles.f2RowFormula}>
        <View style={styles.f2RowFormulaLine}>
          <Text style={styles.f2FormulaText}>Gold Amount = Rate of </Text>
          <View style={styles.dropdownWrap}>
            <Pressable
              onPress={() => setDropdownOpen((prev) => !prev)}
              style={styles.karatDropdown}
            >
              <Text style={styles.karatDropdownText}>{pendingKarat}</Text>
              <ChevronDown size={16} color={Colors.textMuted} />
            </Pressable>
            {dropdownOpen ? (
              <View style={styles.dropdown}>
                {karatOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setPendingKarat(option);
                      setDropdownOpen(false);
                    }}
                    style={[styles.dropdownItem, option === pendingKarat && styles.dropdownItemActive]}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        option === pendingKarat && styles.dropdownItemTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
        <Text style={styles.f2FormulaTrailing}>x Net Wt of Gold</Text>
      </View>
      <View style={[styles.f2RowActions, !isDirty && styles.f2RowActionsCentered]}>
        {isDirty ? (
          <Pressable
            onPress={() => {
              setDropdownOpen(false);
              onSave(pendingKarat);
            }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        ) : null}
        {showDelete ? (
          <Pressable onPress={handleDeletePress} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface DeleteConfirmModalProps {
  visible: boolean;
  karat?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ visible, karat, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={screenStyles.modalOverlay} onPress={onCancel}>
        <Pressable style={styles.deleteModalCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.deleteModalTitle}>Delete Formula Rule</Text>
          <Text style={styles.deleteModalMessage}>
            Do you want to delete this{karat ? ` ${karat}` : ''} rule?
          </Text>
          <View style={styles.deleteModalActions}>
            <Pressable onPress={onCancel} style={styles.deleteModalCancelBtn}>
              <Text style={styles.deleteModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.deleteModalConfirmBtn}>
              <Text style={styles.deleteModalConfirmText}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface AddKaratPickerProps {
  options: string[];
  onSelect: (karat: string) => void;
  onCancel: () => void;
}

function AddKaratPicker({ options, onSelect, onCancel }: AddKaratPickerProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(options[0] ?? '');

  if (options.length === 0) return null;

  return (
    <View style={[styles.addPickerCard, open && { marginBottom: options.length * 38 }]}>
      <Text style={styles.addPickerLabel}>Select Karat</Text>
      <Pressable onPress={() => setOpen((prev) => !prev)} style={styles.karatDropdown}>
        <Text style={styles.karatDropdownText}>{selected}</Text>
        <ChevronDown size={16} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setSelected(option);
                setOpen(false);
              }}
              style={[styles.dropdownItem, option === selected && styles.dropdownItemActive]}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  option === selected && styles.dropdownItemTextActive,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.addPickerActions}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => selected && onSelect(selected)}
          disabled={!selected}
          style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
        >
          <Text style={styles.confirmBtnText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface MasterFormulaConfigProps {
  activeFormula: ActiveFormula;
  onActiveFormulaChange: (formula: ActiveFormula) => void;
  formula2Rows: Formula2Row[];
  onSaveRowKarat: (rowId: number, karat: string) => void | Promise<void>;
  onAddRow: (karat: string) => void | Promise<void>;
  onDeleteRow: (rowId: number) => void | Promise<void>;
  disabled?: boolean;
}

export function MasterFormulaConfig({
  activeFormula,
  onActiveFormulaChange,
  formula2Rows,
  onSaveRowKarat,
  onAddRow,
  onDeleteRow,
  disabled = false,
}: MasterFormulaConfigProps) {
  const [addingField, setAddingField] = useState(false);
  const [deleteTargetRowId, setDeleteTargetRowId] = useState<number | null>(null);

  const usedKarats = formula2Rows.map((row) => row.karat);
  const addOptions = getKaratOptionsForAdd(usedKarats);
  const canAddMore = addOptions.length > 0;
  const showDeleteOnRows = formula2Rows.length > 1;
  const deleteTargetRow = formula2Rows.find((row) => row.id === deleteTargetRowId);

  const handleAddRow = async (karat: string) => {
    await onAddRow(karat);
    setAddingField(false);
  };

  const handleDeleteRow = async (rowId: number) => {
    await onDeleteRow(rowId);
    setDeleteTargetRowId(null);
  };

  return (
    <View style={styles.container}>
      <FormulaOptionBlock
        label="Formula 1"
        isActive={activeFormula === 'F1'}
        onSelect={() => !disabled && onActiveFormulaChange('F1')}
      >
        <Text style={styles.formulaExpression}>
          Gold Amount = MCX Live Rate (24K) x Pure Wt
        </Text>
      </FormulaOptionBlock>

      <FormulaOptionBlock
        label="Formula 2"
        isActive={activeFormula === 'F2'}
        onSelect={() => !disabled && onActiveFormulaChange('F2')}
      >
        <View style={styles.f2Content}>
          {formula2Rows.map((row) => (
            <Formula2RowItem
              key={row.id}
              row={row}
              allRows={formula2Rows}
              showDelete={showDeleteOnRows}
              onSave={(karat) => onSaveRowKarat(row.id, karat)}
              onRequestDelete={() => !disabled && setDeleteTargetRowId(row.id)}
            />
          ))}

          {addingField ? (
            <View style={{ zIndex: 10 }}>
              <AddKaratPicker
                options={addOptions}
                onSelect={handleAddRow}
                onCancel={() => setAddingField(false)}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => !disabled && canAddMore && setAddingField(true)}
              disabled={disabled || !canAddMore}
              style={[styles.addFieldsBtn, !canAddMore && styles.addFieldsBtnDisabled]}
            >
              <Plus size={16} color={canAddMore ? BUTTON_GREEN : Colors.textMuted} />
              <Text style={[styles.addFieldsText, !canAddMore && styles.addFieldsTextDisabled]}>
                Add Fields
              </Text>
            </Pressable>
          )}
        </View>
      </FormulaOptionBlock>

      <DeleteConfirmModal
        visible={deleteTargetRowId !== null}
        karat={deleteTargetRow?.karat}
        onCancel={() => setDeleteTargetRowId(null)}
        onConfirm={() => deleteTargetRowId !== null && handleDeleteRow(deleteTargetRowId)}
      />
    </View>
  );
}

interface FormulaSelectionActionBarProps {
  onApply: () => void;
  onRestore: () => void;
  disabled?: boolean;
}

function FormulaSelectionActionBar({ onApply, onRestore, disabled = false }: FormulaSelectionActionBarProps) {
  return (
    <View style={styles.selectionActionBar}>
      <Pressable
        onPress={onRestore}
        disabled={disabled}
        style={[styles.restoreBtn, disabled && styles.actionBtnDisabled]}
      >
        <Text style={styles.restoreBtnText}>Restore</Text>
      </Pressable>
      <Pressable
        onPress={onApply}
        disabled={disabled}
        style={[styles.applyChangesBtn, disabled && styles.actionBtnDisabled]}
      >
        {disabled ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Text style={styles.applyChangesBtnText}>Apply Changes</Text>
        )}
      </Pressable>
    </View>
  );
}

interface MasterFormulasModuleProps {
  contentContainerStyle?: object;
}

function applySettingsToState(
  settings: FormulaSettings,
  setters: {
    setActiveFormula: (value: ActiveFormula) => void;
    setCommittedFormula: (value: ActiveFormula) => void;
    setFormula2Rows: (rows: Formula2Row[]) => void;
    setNextRowId: (id: number) => void;
  },
) {
  const { rows, nextRowId } = formula2RulesToRows(settings.formula2Rules);
  setters.setActiveFormula(settings.activeFormula);
  setters.setCommittedFormula(settings.activeFormula);
  setters.setFormula2Rows(rows);
  setters.setNextRowId(nextRowId);
  applyFormulaSettingsToStore(settings);
}

export function MasterFormulasModule({ contentContainerStyle }: MasterFormulasModuleProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFormula, setActiveFormula] = useState<ActiveFormula>('F1');
  const [committedFormula, setCommittedFormula] = useState<ActiveFormula>('F1');
  const [formula2Rows, setFormula2Rows] = useState<Formula2Row[]>([{ id: 1, karat: '14K' }]);
  const nextRowIdRef = useRef(2);

  const hasPendingFormulaChange = activeFormula !== committedFormula;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await fetchFormulaSettings();
      applySettingsToState(settings, {
        setActiveFormula,
        setCommittedFormula,
        setFormula2Rows,
        setNextRowId: (id) => {
          nextRowIdRef.current = id;
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load formula settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback(
    async (formula: ActiveFormula, rows: Formula2Row[]) => {
      setSaving(true);
      setError(null);
      try {
        const settings = await updateFormulaSettings({
          activeFormula: formula,
          formula2Rules: rows.map((row) => row.karat),
        });
        applySettingsToState(settings, {
          setActiveFormula,
          setCommittedFormula,
          setFormula2Rows,
          setNextRowId: (id) => {
            nextRowIdRef.current = id;
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save formula settings';
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const handleApplyChanges = async () => {
    try {
      await persistSettings(activeFormula, formula2Rows);
    } catch {
      // Error state is already set for display.
    }
  };

  const handleRestore = () => {
    setActiveFormula(committedFormula);
  };

  const handleSaveRowKarat = async (rowId: number, karat: string) => {
    const updatedRows = formula2Rows.map((row) => (row.id === rowId ? { ...row, karat } : row));
    setFormula2Rows(updatedRows);
    try {
      await persistSettings(committedFormula, updatedRows);
    } catch {
      await loadSettings();
    }
  };

  const handleAddRow = async (karat: string) => {
    const updatedRows = [...formula2Rows, { id: nextRowIdRef.current++, karat }];
    setFormula2Rows(updatedRows);
    try {
      await persistSettings(committedFormula, updatedRows);
    } catch {
      await loadSettings();
    }
  };

  const handleDeleteRow = async (rowId: number) => {
    const updatedRows = formula2Rows.filter((row) => row.id !== rowId);
    setFormula2Rows(updatedRows);
    try {
      await persistSettings(committedFormula, updatedRows);
    } catch {
      await loadSettings();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={BUTTON_GREEN} />
        <Text style={styles.loadingText}>Loading formula settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.moduleScroll}
      contentContainerStyle={[styles.moduleScrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <View style={screenStyles.screenSection}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void loadSettings()} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        <MasterFormulaConfig
          activeFormula={activeFormula}
          onActiveFormulaChange={setActiveFormula}
          formula2Rows={formula2Rows}
          onSaveRowKarat={handleSaveRowKarat}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          disabled={saving}
        />
        {hasPendingFormulaChange ? (
          <FormulaSelectionActionBar
            onApply={() => void handleApplyChanges()}
            onRestore={handleRestore}
            disabled={saving}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  moduleScroll: {
    flex: 1,
  },
  moduleScrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.screenBottom,
  },
  selectionActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xxl, 
  },
  restoreBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  restoreBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  applyChangesBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    paddingVertical: 14,
  },
  applyChangesBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  actionBtnDisabled: {
    opacity: 0.7,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: '#F5C6C2',
    backgroundColor: '#FFF5F5',
    borderRadius: Radius.input,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: '#D9291F',
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: '#F5C6C2',
    backgroundColor: Colors.white,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D9291F',
  },
  container: { gap: Spacing.lg },
  formulaOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BUTTON_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BUTTON_GREEN,
  },
  formulaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    gap: Spacing.sm,
  },
  formulaCardActive: { borderColor: BUTTON_GREEN, backgroundColor: '#F4ECDC' },
  formulaCardLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  formulaCardLabelActive: { color: BUTTON_GREEN },
  formulaExpression: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  f2Content: { gap: Spacing.md },
  f2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.md,
    backgroundColor: Colors.white,
  },
  f2RowFormula: {
    flex: 1,
    gap: 4,
  },
  f2RowFormulaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  f2FormulaText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  f2FormulaTrailing: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  dropdownWrap: { position: 'relative', zIndex: 1 },
  karatDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.white,
    minWidth: 92,
  },
  karatDropdownText: { fontSize: 14, fontWeight: '600', color: BUTTON_GREEN },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    zIndex: 10,
  },
  dropdownItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  dropdownItemActive: { backgroundColor: '#F4ECDC' },
  dropdownItemText: { fontSize: 14, color: Colors.textPrimary },
  dropdownItemTextActive: { fontWeight: '700', color: BUTTON_GREEN },
  f2RowActions: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
    minWidth: 72,
  },
  f2RowActionsCentered: {
    justifyContent: 'center',
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: BUTTON_GREEN,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5C6C2',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF5F5',
  },
  deleteBtnText: { color: '#D9291F', fontSize: 12, fontWeight: '600' },
  deleteModalCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  deleteModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  deleteModalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingVertical: 12,
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteModalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#D9291F',
    borderRadius: Radius.button,
    paddingVertical: 12,
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  addFieldsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BUTTON_GREEN,
    borderRadius: Radius.input,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  addFieldsBtnDisabled: { borderColor: Colors.border },
  addFieldsText: { fontSize: 14, fontWeight: '600', color: BUTTON_GREEN },
  addFieldsTextDisabled: { color: Colors.textMuted },
  addPickerCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    gap: Spacing.sm,
  },
  addPickerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  addPickerActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingVertical: 10,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    paddingVertical: 10,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },
});
