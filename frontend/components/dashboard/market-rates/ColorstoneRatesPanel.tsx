import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';

import { DeleteStoneRateModal } from '@/components/dashboard/market-rates/DeleteStoneRateModal';
import { ColorstoneRateFormModal } from '@/components/dashboard/market-rates/ColorstoneRateFormModal';
import type { ToastType } from '@/components/scanner/ToastNotification';
import {
  deleteColorstoneRate,
  fetchColorstoneRates,
  upsertColorstoneRate,
} from '@/utils/ratesApi';
import {
  STONE_CLARITY_OPTIONS,
  getColorOptionsForStoneType,
  type StoneSelectOption,
} from '@/constants/stoneRateOptions';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { StoneRate, UpsertStoneRatePayload } from '@/types/rates';
import { findDuplicateStoneRate, stoneRateSummary, validateStoneRateForm } from '@/utils/stoneRateUtils';

const DELETE_RED = '#A81F17';
const BUTTON_GREEN = '#A81F17';

interface ColorstoneRatesPanelProps {
  onToast?: (message: string, type?: ToastType) => void;
}

function formatRateValue(rate: number): string {
  if (!Number.isFinite(rate)) return '0';
  return Math.round(rate).toLocaleString('en-IN');
}

function formatTableValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'None';
  return trimmed;
}

export function ColorstoneRatesPanel({ onToast }: ColorstoneRatesPanelProps) {
  const [rates, setRates] = useState<StoneRate[]>([]);
  const [editingRate, setEditingRate] = useState<StoneRate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [color, setColor] = useState('');
  const [clarity, setClarity] = useState('');
  const [rateValue, setRateValue] = useState('');
  const [formErrors, setFormErrors] = useState<{
    color?: string;
    clarity?: string;
    rate?: string;
  }>({});
  const [deletingRate, setDeletingRate] = useState<StoneRate | null>(null);
  const [saving, setSaving] = useState(false);

  const [customColors, setCustomColors] = useState<string[]>([]);
  const [customClarities, setCustomClarities] = useState<string[]>([]);

  const notify = (message: string, type: ToastType = 'info') => {
    onToast?.(message, type);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchColorstoneRates();
        if (active) setRates(data);
      } catch (err) {
        if (active) notify('Failed to load rates', 'error');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const colorOptions = useMemo<StoneSelectOption[]>(() => {
    const defaults = getColorOptionsForStoneType('colorstone');
    const fromRates = rates.map((rate) => rate.color).filter(Boolean);
    const merged = [...defaults, ...fromRates, ...customColors]
      .map((value) => value.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(merged));
    return unique.map((option) => ({ value: option, label: option }));
  }, [rates, customColors]);

  const clarityOptions = useMemo<StoneSelectOption[]>(() => {
    const fromRates = rates.map((rate) => rate.clarity).filter(Boolean);
    const merged = [...STONE_CLARITY_OPTIONS, ...fromRates, ...customClarities]
      .map((value) => value.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(merged));
    return unique.map((option) => ({ value: option, label: option }));
  }, [rates, customClarities]);

  const openAdd = () => {
    setIsNew(true);
    setEditingRate(null);
    setColor('');
    setClarity('');
    setRateValue('');
    setFormErrors({});
  };

  const openEdit = (rate: StoneRate) => {
    setIsNew(false);
    setEditingRate(rate);
    setColor(rate.color);
    setClarity(rate.clarity);
    setRateValue(String(rate.rate));
    setFormErrors({});
  };

  const closeForm = () => {
    setIsNew(false);
    setEditingRate(null);
    setFormErrors({});
  };

  const handleSave = async () => {
    const errors = validateStoneRateForm(color, clarity, rateValue, undefined, false);
    if (errors) {
      setFormErrors(errors);
      return;
    }

    const trimmedColor = color.trim();
    const trimmedClarity = clarity.trim();
    const rate = Number(rateValue);

    if (
      findDuplicateStoneRate(
        rates,
        trimmedColor,
        trimmedClarity,
        '',
        editingRate?.id,
      )
    ) {
      notify('A rate with the same color and clarity already exists.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: UpsertStoneRatePayload = {
        color: trimmedColor,
        clarity: trimmedClarity,
        rate,
      };

      const savedRate = await upsertColorstoneRate(payload);

      setRates((prev) => {
        if (editingRate) {
          return prev.map((item) => (item.id === editingRate.id ? savedRate : item));
        }
        return [...prev, savedRate];
      });

      closeForm();
      notify(`Colorstone rate ${editingRate ? 'updated' : 'added'}`, 'success');
    } catch (err) {
      notify('Failed to save colorstone rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRate) return;
    setSaving(true);
    try {
      await deleteColorstoneRate(deletingRate.id);
      setRates((prev) => prev.filter((item) => item.id !== deletingRate.id));
      notify('Colorstone rate deleted', 'success');
      setDeletingRate(null);
    } catch (err) {
      notify('Failed to delete colorstone rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable onPress={openAdd} style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Add Colorstone Rate</Text>
      </Pressable>

      {rates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No colorstone rates yet</Text>
          <Text style={styles.emptyText}>
            Tap Add Colorstone Rate to configure color and clarity rates.
          </Text>
        </View>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.headerCell, styles.colorCell]}>Color</Text>
            <Text style={[styles.headerCell, styles.clarityCell]}>Clarity</Text>
            <Text style={[styles.headerCell, styles.rateCell]}>Rate (₹)</Text>
            <Text style={[styles.headerCell, styles.actionCell]}>Edit</Text>
            <Text style={[styles.headerCell, styles.actionCell, styles.deleteHeaderCell]}>
              Delete
            </Text>
          </View>

          {rates.map((rate, index) => {
            const rowBorder = index < rates.length - 1;
            return (
              <View key={rate.id} style={[styles.row, rowBorder && styles.rowBorder]}>
                <Text style={[styles.cell, styles.colorCell]} numberOfLines={1}>
                  {formatTableValue(rate.color || 'None')}
                </Text>
                <Text style={[styles.cell, styles.clarityCell]} numberOfLines={1}>
                  {formatTableValue(rate.clarity || 'None')}
                </Text>
                <Text style={[styles.cell, styles.rateCell]} numberOfLines={1}>
                  {formatRateValue(rate.rate)}
                </Text>
                <View style={styles.actionCell}>
                  <Pressable
                    onPress={() => openEdit(rate)}
                    style={[styles.iconBtn, styles.editBtn]}
                    hitSlop={8}
                    accessibilityLabel="Edit colorstone rate"
                  >
                    <Pencil size={13} color={Colors.textPrimary} strokeWidth={2.25} />
                  </Pressable>
                </View>
                <View style={[styles.actionCell, styles.deleteActionCell]}>
                  <Pressable
                    onPress={() => setDeletingRate(rate)}
                    style={[styles.iconBtn, styles.deleteBtn]}
                    hitSlop={8}
                    accessibilityLabel="Delete colorstone rate"
                  >
                    <Trash2 size={13} color={DELETE_RED} strokeWidth={2.25} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ColorstoneRateFormModal
        visible={isNew || editingRate !== null}
        isNew={isNew}
        color={color}
        clarity={clarity}
        rateValue={rateValue}
        errors={formErrors}
        saving={saving}
        colorOptions={colorOptions}
        clarityOptions={clarityOptions}
        onColorChange={(value) => {
          setColor(value);
          if (formErrors.color || formErrors.clarity) {
            setFormErrors((prev) => ({ ...prev, color: undefined, clarity: undefined }));
          }
        }}
        onClarityChange={(value) => {
          setClarity(value);
          if (formErrors.color || formErrors.clarity) {
            setFormErrors((prev) => ({ ...prev, color: undefined, clarity: undefined }));
          }
        }}
        onRateChange={(value) => {
          setRateValue(value.replace(/[^\d.]/g, ''));
          if (formErrors.rate) {
            setFormErrors((prev) => ({ ...prev, rate: undefined }));
          }
        }}
        onAddCustomColor={(value) => {
          if (!customColors.includes(value)) setCustomColors((prev) => [...prev, value]);
        }}
        onAddCustomClarity={(value) => {
          if (!customClarities.includes(value)) setCustomClarities((prev) => [...prev, value]);
        }}
        validateCustomValue={(value, type) => {
          const normalized = value.trim();
          const existing = type === 'color' ? colorOptions : clarityOptions;
          if (existing.some((option) => option.value.toUpperCase() === normalized.toUpperCase())) {
            return 'Value already exists.';
          }
          return null;
        }}
        onClose={closeForm}
        onSave={handleSave}
      />

      <DeleteStoneRateModal
        visible={deletingRate !== null}
        title="Delete Colorstone Rate?"
        subtitle={deletingRate ? `This will permanently remove ${stoneRateSummary(deletingRate)}.` : ''}
        onClose={() => setDeletingRate(null)}
        onConfirm={handleConfirmDelete}
        confirming={saving}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    height: Spacing.buttonHeight,
    borderRadius: Radius.button,
    backgroundColor: BUTTON_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  addBtnText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  emptyCard: {
    ...screenStyles.emptyCard,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  table: {
    ...screenStyles.table,
  },
  row: {
    ...screenStyles.tableDataRow,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 38,
  },
  headerRow: {
    ...screenStyles.tableHeaderRow,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  headerCell: {
    ...screenStyles.tableHeaderCell,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  cell: {
    ...screenStyles.tableCell,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  rowBorder: {
    ...screenStyles.tableRowBorder,
  },
  colorCell: { flex: 1 },
  clarityCell: { flex: 1 },
  rateCell: { flex: 1 },
  actionCell: { width: 44, alignItems: 'center', justifyContent: 'center' },
  deleteHeaderCell: { paddingRight: 6 },
  deleteActionCell: { paddingRight: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FBF7F0',
  },
  editBtn: {
    backgroundColor: '#FBF7F0',
    borderColor: '#E9DDC4',
  },
  deleteBtn: {
    backgroundColor: '#FFF4F3',
    borderColor: '#F4C9C6',
  },
  iconBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
});
