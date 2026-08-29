import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';

import { DeleteStoneRateModal } from '@/components/dashboard/market-rates/DeleteStoneRateModal';
import { DiamondRateFormModal } from '@/components/dashboard/market-rates/DiamondRateFormModal';
import type { ToastType } from '@/components/scanner/ToastNotification';
import {
  deleteDiamondRate,
  fetchDiamondRates,
  upsertDiamondRate,
} from '@/utils/ratesApi';
import {
  DIAMOND_SHAPE_OPTIONS,
  STONE_CLARITY_OPTIONS,
  getColorOptionsForStoneType,
  type StoneSelectOption,
} from '@/constants/stoneRateOptions';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { StoneRate, UpsertStoneRatePayload } from '@/types/rates';
import { findDuplicateStoneRate } from '@/utils/stoneRateUtils';

const BUTTON_GREEN = '#A81F17';
const DELETE_RED = '#A81F17';

interface DiamondRatesPanelProps {
  onToast?: (message: string, type?: ToastType) => void;
}

interface DiamondRateFormErrors {
  packetCode?: string;
  shape?: string;
  color?: string;
  clarity?: string;
  rate?: string;
  duplicate?: string;
}

const SHAPE_LABEL_MAP = new Map(
  DIAMOND_SHAPE_OPTIONS.map((option) => [option.value.toUpperCase(), option.label]),
);
const SHAPE_VALUE_MAP = new Map(
  DIAMOND_SHAPE_OPTIONS.map((option) => [option.value.toUpperCase(), option.value]),
);

function normalizeDiamondShape(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed === '0') return '';
  const upper = trimmed.toUpperCase();
  return SHAPE_VALUE_MAP.get(upper) ?? trimmed;
}

function formatInr(rate: number): string {
  if (!Number.isFinite(rate)) return '0';
  return Math.round(rate).toLocaleString('en-IN');
}

function formatTableValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  return trimmed;
}

function compactTableValue(value: string): string {
  const formatted = formatTableValue(value);
  if (formatted === '—') return formatted;
  if (formatted.length <= 4) return formatted;
  return `${formatted.slice(0, 4)}...`;
}

function shapeLabel(value?: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '0') return '';
  const label = SHAPE_LABEL_MAP.get(trimmed.toUpperCase());
  return label ?? trimmed;
}

function sortDiamondRates(rates: StoneRate[]): StoneRate[] {
  return [...rates].sort((a, b) => {
    const shapeA = normalizeDiamondShape(a.shape ?? '').toLowerCase();
    const shapeB = normalizeDiamondShape(b.shape ?? '').toLowerCase();
    if (shapeA !== shapeB) return shapeA.localeCompare(shapeB);
    const colorA = a.color.trim().toLowerCase();
    const colorB = b.color.trim().toLowerCase();
    if (colorA !== colorB) return colorA.localeCompare(colorB);
    const clarityA = a.clarity.trim().toLowerCase();
    const clarityB = b.clarity.trim().toLowerCase();
    return clarityA.localeCompare(clarityB);
  });
}

export function DiamondRatesPanel({ onToast }: DiamondRatesPanelProps) {
  const [rates, setRates] = useState<StoneRate[]>([]);
  const [editingRate, setEditingRate] = useState<StoneRate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [packetCode, setPacketCode] = useState('');
  const [color, setColor] = useState('');
  const [clarity, setClarity] = useState('');
  const [shape, setShape] = useState('');
  const shapeRef = useRef('');
  const [rateValue, setRateValue] = useState('');
  const [formErrors, setFormErrors] = useState<DiamondRateFormErrors>({});
  const [deletingRate, setDeletingRate] = useState<StoneRate | null>(null);
  const [saving, setSaving] = useState(false);

  const notify = (message: string, type: ToastType = 'info') => {
    onToast?.(message, type);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchDiamondRates();
        if (active) setRates(data);
      } catch (err) {
        if (active) notify('Failed to load diamond rates', 'error');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const sortedRates = useMemo(() => sortDiamondRates(rates), [rates]);

  const colorOptions = useMemo<StoneSelectOption[]>(() => {
    const defaults = getColorOptionsForStoneType('diamond');
    const fromRates = rates.map((rate) => rate.color).filter(Boolean);
    const merged = [...defaults, ...fromRates]
      .map((value) => value.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(merged));
    return unique.map((option) => ({ value: option, label: option }));
  }, [rates]);

  const clarityOptions = useMemo<StoneSelectOption[]>(() => {
    const fromRates = rates.map((rate) => rate.clarity).filter(Boolean);
    const merged = [...STONE_CLARITY_OPTIONS, ...fromRates]
      .map((value) => value.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(merged));
    return unique.map((option) => ({ value: option, label: option }));
  }, [rates]);

  const shapeOptions = useMemo<StoneSelectOption[]>(() => {
    const defaultShapes = DIAMOND_SHAPE_OPTIONS.map((option) => option.value);
    const fromRates = rates.map((rate) => rate.shape ?? '').filter(Boolean);
    const merged = [...defaultShapes, ...fromRates]
      .map(normalizeDiamondShape)
      .filter(Boolean);
    const unique = Array.from(new Set(merged.map((value) => value.toUpperCase())));
    const labelMap = new Map(
      DIAMOND_SHAPE_OPTIONS.map((option) => [option.value.toUpperCase(), option.label]),
    );
    return unique.map((value) => {
      const label = labelMap.get(value) ?? value;
      const storedValue = SHAPE_VALUE_MAP.get(value) ?? value;
      return { value: storedValue, label };
    });
  }, [rates]);

  const resetForm = () => {
    setPacketCode('');
    setColor('');
    setClarity('');
    setShape('');
    shapeRef.current = '';
    setRateValue('');
    setFormErrors({});
  };

  const openAdd = () => {
    setIsNew(true);
    setEditingRate(null);
    resetForm();
  };

  const openEdit = (rate: StoneRate) => {
    setIsNew(false);
    setEditingRate(rate);
    setPacketCode(rate.packetCode ?? '');
    setColor(rate.color ?? '');
    setClarity(rate.clarity ?? '');
    const normalized = normalizeDiamondShape(rate.shape ?? '');
    setShape(normalized);
    shapeRef.current = normalized;
    setRateValue(String(rate.rate));
    setFormErrors({});
  };

  const closeForm = () => {
    setIsNew(false);
    setEditingRate(null);
    setFormErrors({});
  };

  const handleSave = async () => {
    const normalizedPacketCode = packetCode.trim().toUpperCase();
    const normalizedColor = color.trim();
    const normalizedClarity = clarity.trim();
    const normalizedShape = normalizeDiamondShape(shapeRef.current);
    const hasAnyField = Boolean(
      normalizedPacketCode || normalizedShape || normalizedColor || normalizedClarity,
    );

    const nextErrors: DiamondRateFormErrors = {};
    if (!hasAnyField) {
      nextErrors.packetCode = 'Enter Packet Code or select Shape, Color or Clarity.';
      nextErrors.shape = 'Select at least Shape, Color or Clarity.';
      nextErrors.color = 'Select at least Shape, Color or Clarity.';
      nextErrors.clarity = 'Select at least Shape, Color or Clarity.';
    }

    const rate = Number(rateValue);
    if (!rateValue.trim() || !Number.isFinite(rate) || rate <= 0) {
      nextErrors.rate = 'Enter a valid rate.';
    }

    if (
      findDuplicateStoneRate(
        rates,
        normalizedColor,
        normalizedClarity,
        normalizedShape,
        normalizedPacketCode,
        editingRate?.id,
      )
    ) {
      nextErrors.duplicate =
        'A rate with the same Shape, Color and Clarity already exists.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload: UpsertStoneRatePayload = {
        id: editingRate?.id,
        color: normalizedColor,
        clarity: normalizedClarity,
        rate,
        shape: normalizedShape,
        packetCode: normalizedPacketCode,
      };

      const savedRate = await upsertDiamondRate(payload);

      setRates((prev) => {
        if (!editingRate) return [...prev, savedRate];
        return [
          ...prev.filter((item) => item.id !== editingRate.id),
          savedRate,
        ];
      });

      closeForm();
      notify(`Diamond rate ${editingRate ? 'updated' : 'added'}`, 'success');
    } catch (err) {
      notify('Failed to save diamond rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRate) return;
    setSaving(true);
    try {
      await deleteDiamondRate(deletingRate.id);
      setRates((prev) => prev.filter((item) => item.id !== deletingRate.id));
      notify('Diamond rate deleted', 'success');
      setDeletingRate(null);
    } catch (err) {
      notify('Failed to delete diamond rate', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable onPress={openAdd} style={styles.addBtn}>
        <Text style={styles.addBtnText}>+ Add Diamond Rate</Text>
      </Pressable>

      {sortedRates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No diamond rates yet</Text>
          <Text style={styles.emptyText}>Tap Add Diamond Rate to configure rates.</Text>
        </View>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.headerCell, styles.packetCell]}>PKT Code</Text>
            <Text style={[styles.headerCell, styles.shapeCell]}>Shape</Text>
            <Text style={[styles.headerCell, styles.colorCell]}>Color</Text>
            <Text style={[styles.headerCell, styles.clarityCell]}>Clarity</Text>
            <Text style={[styles.headerCell, styles.rateCell]}>Rate</Text>
            <Text style={[styles.headerCell, styles.actionCell]}>Edit</Text>
            <Text style={[styles.headerCell, styles.actionCell, styles.deleteHeaderCell]}>
              Delete
            </Text>
          </View>

          {sortedRates.map((rate, index) => {
            const shapeText = compactTableValue(shapeLabel(rate.shape));
            const colorText = compactTableValue(rate.color ?? '');
            const clarityText = compactTableValue(rate.clarity ?? '');
            const packetText = compactTableValue(rate.packetCode ?? '');
            const rowBorder = index < sortedRates.length - 1;
            return (
              <View
                key={rate.id}
                style={[styles.row, rowBorder && styles.rowBorder]}
              >
                <Text style={[styles.cell, styles.packetCell]} numberOfLines={1}>
                  {packetText}
                </Text>
                <Text style={[styles.cell, styles.shapeCell]} numberOfLines={1}>
                  {shapeText}
                </Text>
                <Text style={[styles.cell, styles.colorCell]} numberOfLines={1}>
                  {colorText}
                </Text>
                <Text style={[styles.cell, styles.clarityCell]} numberOfLines={1}>
                  {clarityText}
                </Text>
                <Text style={[styles.cell, styles.rateCell]} numberOfLines={1}>
                  ₹{formatInr(rate.rate)}
                </Text>
                <View style={styles.actionCell}>
                  <Pressable
                    onPress={() => openEdit(rate)}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      styles.editBtn,
                      pressed && styles.iconBtnPressed,
                    ]}
                    hitSlop={8}
                    accessibilityLabel="Edit diamond rate"
                  >
                    <Pencil size={13} color={Colors.textPrimary} strokeWidth={2.25} />
                  </Pressable>
                </View>
                <View style={[styles.actionCell, styles.deleteActionCell]}>
                  <Pressable
                    onPress={() => setDeletingRate(rate)}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      styles.deleteBtn,
                      pressed && styles.iconBtnPressed,
                    ]}
                    hitSlop={8}
                    accessibilityLabel="Delete diamond rate"
                  >
                    <Trash2 size={13} color={DELETE_RED} strokeWidth={2.25} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <DiamondRateFormModal
        visible={isNew || editingRate !== null}
        isNew={isNew}
        packetCode={packetCode}
        shape={shape}
        color={color}
        clarity={clarity}
        rateValue={rateValue}
        errors={formErrors}
        saving={saving}
        shapeOptions={shapeOptions}
        colorOptions={colorOptions}
        clarityOptions={clarityOptions}
        onPacketCodeChange={(value) => {
          const next = value.toUpperCase();
          setPacketCode(next);
          if (formErrors.packetCode || formErrors.duplicate) {
            setFormErrors((prev) => ({ ...prev, packetCode: undefined, duplicate: undefined }));
          }
        }}
        onShapeChange={(value) => {
          setShape(value);
          shapeRef.current = value;
          if (formErrors.shape || formErrors.duplicate) {
            setFormErrors((prev) => ({ ...prev, shape: undefined, duplicate: undefined }));
          }
        }}
        onColorChange={(value) => {
          setColor(value);
          if (formErrors.color || formErrors.duplicate) {
            setFormErrors((prev) => ({ ...prev, color: undefined, duplicate: undefined }));
          }
        }}
        onClarityChange={(value) => {
          setClarity(value);
          if (formErrors.clarity || formErrors.duplicate) {
            setFormErrors((prev) => ({ ...prev, clarity: undefined, duplicate: undefined }));
          }
        }}
        onRateChange={(value) => {
          setRateValue(value.replace(/[^\d.]/g, ''));
          if (formErrors.rate || formErrors.duplicate) {
            setFormErrors((prev) => ({ ...prev, rate: undefined, duplicate: undefined }));
          }
        }}
        onClose={closeForm}
        onSave={handleSave}
      />

      <DeleteStoneRateModal
        visible={deletingRate !== null}
        title="Delete Diamond Rate?"
        subtitle={
          deletingRate
            ? `This will permanently remove ${
                deletingRate.packetCode?.trim() ? deletingRate.packetCode.trim() : '—'
              } / ${shapeLabel(deletingRate.shape) || '—'} / ${
                deletingRate.color?.trim() ? deletingRate.color : '—'
              } / ${deletingRate.clarity?.trim() ? deletingRate.clarity : '—'
              }.`
            : ''
        }
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
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  headerRow: {
    ...screenStyles.tableHeaderRow,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  headerCell: {
    ...screenStyles.tableHeaderCell,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 12,
  },
  cell: {
    ...screenStyles.tableCell,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 12,
  },
  rowBorder: {
    ...screenStyles.tableRowBorder,
  },
  packetCell: { flex: 1.2, minWidth: 0 },
  shapeCell: { flex: 1, minWidth: 0 },
  colorCell: { flex: 0.9, minWidth: 0 },
  clarityCell: { flex: 1, minWidth: 0 },
  rateCell: { width: 68, flexShrink: 0 },
  actionCell: { width: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
