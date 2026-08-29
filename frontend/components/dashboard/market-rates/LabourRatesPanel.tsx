import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Pencil } from 'lucide-react-native';

import { LabourRateEditModal } from '@/components/dashboard/market-rates/LabourRateEditModal';
import type { ToastType } from '@/components/scanner/ToastNotification';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LabourRate } from '@/types/rates';
import { ApiError } from '@/utils/apiClient';
import {
  formatLabourRateDisplay,
  labourRateFormToPayload,
  labourRateToFormValues,
  validateLabourRateForm,
  type LabourRateFormErrors,
} from '@/utils/labourRateUtils';
import { fetchLabourRate, upsertLabourRate } from '@/utils/ratesApi';

const BUTTON_GREEN = '#A81F17';

interface LabourRatesPanelProps {
  onToast?: (message: string, type?: ToastType) => void;
}

export function LabourRatesPanel({ onToast }: LabourRatesPanelProps) {
  const [labourRate, setLabourRate] = useState<LabourRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [rupeesUnit, setRupeesUnit] = useState<'Per Gram' | 'Per 10 Gram'>('Per Gram');
  const [formErrors, setFormErrors] = useState<LabourRateFormErrors>({});

  const notify = (message: string, type: ToastType = 'info') => {
    onToast?.(message, type);
  };

  const loadLabourRate = useCallback(async () => {
    setLoading(true);

    try {
      const rate = await fetchLabourRate();
      setLabourRate(rate);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to load labour rate. Please try again.';
      onToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useFocusEffect(
    useCallback(() => {
      void loadLabourRate();
    }, [loadLabourRate]),
  );

  const openEdit = () => {
    const values = labourRateToFormValues(labourRate);
    setAmount(values.amount);
    setPercentage(values.percentage);
    setRupeesUnit(values.rupeesUnit);
    setFormErrors({});
    setModalVisible(true);
  };

  const closeEdit = () => {
    setModalVisible(false);
    setFormErrors({});
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (value.trim()) {
      setPercentage('');
    }
    if (formErrors.amount || formErrors.percentage) {
      setFormErrors({});
    }
  };

  const handlePercentageChange = (value: string) => {
    setPercentage(value);
    if (value.trim()) {
      setAmount('');
    }
    if (formErrors.amount || formErrors.percentage) {
      setFormErrors({});
    }
  };

  const handleSave = async () => {
    const errors = validateLabourRateForm(amount, percentage);
    if (errors) {
      setFormErrors(errors);
      return;
    }

    const payload = labourRateFormToPayload(amount, percentage, rupeesUnit);
    if (!payload) return;

    setSaving(true);
    try {
      const updated = await upsertLabourRate(payload);
      setLabourRate(updated);
      closeEdit();
      notify('Labour charge updated successfully', 'success');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Failed to save labour rate. Please try again.';
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={BUTTON_GREEN} />
        <Text style={styles.loadingText}>Loading labour charges…</Text>
      </View>
    );
  }

  const displayValue = formatLabourRateDisplay(labourRate);
  const isEmpty = labourRate === null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Labour charges :</Text>
          <Text style={[styles.value, isEmpty && styles.valueEmpty]}>{displayValue}</Text>
          <Pressable onPress={openEdit} style={styles.editBtn}>
            <Pencil size={14} color={Colors.white} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
        {isEmpty ? (
          <Text style={styles.helperText}>
            No default labour charge set. Tap Edit to configure amount or purity %.
          </Text>
        ) : null}
      </View>

      <LabourRateEditModal
        visible={modalVisible}
        amount={amount}
        percentage={percentage}
        rupeesUnit={rupeesUnit}
        amountDisabled={Boolean(percentage.trim())}
        percentageDisabled={Boolean(amount.trim())}
        errors={formErrors}
        saving={saving}
        onAmountChange={handleAmountChange}
        onPercentageChange={handlePercentageChange}
        onRupeesUnitChange={setRupeesUnit}
        onClose={closeEdit}
        onSave={() => void handleSave()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  card: {
    ...screenStyles.emptyCard,
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    minWidth: 120,
  },
  valueEmpty: {
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
