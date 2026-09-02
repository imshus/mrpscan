import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { memo, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react-native';

import { FieldLabel } from '@/components/scanner/FieldLabel';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { Colors, Radius } from '@/constants/theme';
import { DEFAULT_CHARGE_OPTIONS } from '@/constants/otherCharges';
import type { OtherChargeItem } from '@/types/scanner';
import { createCustomCharge, fetchChargeNames } from '@/utils/customChargesApi';

interface OtherChargesSectionProps {
  charges: OtherChargeItem[];
  onChargesChange: (items: OtherChargeItem[]) => void;
}

function sanitizeAmountInput(text: string): string {
  return text.replace(/[₹,\s]/g, '');
}

function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

const ADD_CUSTOM_CHARGE_VALUE = '__ADD_CUSTOM__';

export const OtherChargesSection = memo(function OtherChargesSection({
  charges,
  onChargesChange,
}: OtherChargesSectionProps) {
  const [allChargeOptions, setAllChargeOptions] = useState<string[]>([...DEFAULT_CHARGE_OPTIONS]);
  const [loadingCharges, setLoadingCharges] = useState(true);
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [customChargeModalVisible, setCustomChargeModalVisible] = useState(false);
  
  const [selectedChargeName, setSelectedChargeName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [customChargeInput, setCustomChargeInput] = useState('');
  
  const [errors, setErrors] = useState<{ amount?: string; customName?: string }>({});
  const [savingCustomCharge, setSavingCustomCharge] = useState(false);

  // Load charge names on mount
  useEffect(() => {
    let cancelled = false;
    
    const loadChargeNames = async () => {
      try {
        const data = await fetchChargeNames();
        if (!cancelled) {
          setAllChargeOptions(data.allCharges);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load charge names:', error);
          // Fallback to default options
          setAllChargeOptions([...DEFAULT_CHARGE_OPTIONS]);
        }
      } finally {
        if (!cancelled) {
          setLoadingCharges(false);
        }
      }
    };

    void loadChargeNames();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(
    () => charges.reduce((sum, item) => sum + (item.amount || 0), 0),
    [charges],
  );

  const chargeDropdownOptions = useMemo(() => {
    // Create options list with all charges + "Add Custom Charge"
    const options = allChargeOptions.map((name) => ({
      value: name,
      label: name,
    }));
    
    // Add the "Add Custom Charge" option at the end
    options.push({
      value: ADD_CUSTOM_CHARGE_VALUE,
      label: '+ Add Custom Charge',
    });
    
    return options;
  }, [allChargeOptions]);

  const openAddCharge = () => {
    setSelectedChargeName('');
    setAmountInput('');
    setErrors({});
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setSelectedChargeName('');
    setAmountInput('');
    setErrors({});
  };

  const openCustomChargeModal = () => {
    setCustomChargeInput('');
    setErrors({});
    setCustomChargeModalVisible(true);
  };

  const closeCustomChargeModal = () => {
    setCustomChargeModalVisible(false);
    setCustomChargeInput('');
    setErrors({});
  };

  const handleChargeNameSelect = (value: string) => {
    if (value === ADD_CUSTOM_CHARGE_VALUE) {
      // Open custom charge creation modal
      openCustomChargeModal();
      return;
    }
    setSelectedChargeName(value);
  };

  const handleSaveCustomCharge = async () => {
    const trimmedName = customChargeInput.trim();
    
    if (!trimmedName) {
      setErrors({ customName: 'Charge name is required' });
      return;
    }

    setSavingCustomCharge(true);
    try {
      await createCustomCharge({ name: trimmedName });
      
      // Refresh charge names
      const data = await fetchChargeNames();
      setAllChargeOptions(data.allCharges);
      
      // Auto-select the newly created charge
      setSelectedChargeName(trimmedName);
      
      closeCustomChargeModal();
      Alert.alert('Success', 'Custom charge created successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create custom charge';
      Alert.alert('Error', message);
    } finally {
      setSavingCustomCharge(false);
    }
  };

  const handleSaveCharge = () => {
    const numericAmount = Number.parseFloat(amountInput.replace(/[^\d.]/g, '')) || 0;
    const nextErrors: { amount?: string } = {};
    
    if (!selectedChargeName) {
      Alert.alert('Error', 'Please select a charge name');
      return;
    }
    
    if (!numericAmount || numericAmount <= 0) {
      nextErrors.amount = 'Enter a valid amount';
      setErrors(nextErrors);
      return;
    }

    const newCharge: OtherChargeItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: selectedChargeName,
      amount: numericAmount,
    };
    
    onChargesChange([...charges, newCharge]);
    closeAddModal();
  };

  const handleDeleteCharge = (index: number) => {
    const next = charges.filter((_, i) => i !== index);
    onChargesChange(next);
  };

  return (
    <View style={styles.chargesTile}>
      <View style={styles.chargesHead}>
        <Text style={styles.chargesTitle}>Other Charges</Text>
        <Pressable
          onPress={openAddCharge}
          disabled={loadingCharges}
          style={[styles.addChargeBtn, loadingCharges && styles.addChargeBtnDisabled]}
        >
          <Text style={styles.addChargeBtnText}>+ Add Other Charges</Text>
        </Pressable>
      </View>

      {charges.length > 0 ? (
        <>
          {charges.map((item, index) => (
            <View key={item.id} style={styles.chargeRow}>
              <View style={styles.chargeRowBox}>
                <Text style={styles.chargeRowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.chargeRowAmount}>{formatInr(item.amount)}</Text>
              </View>
              <Pressable
                onPress={() => handleDeleteCharge(index)}
                style={styles.chargeDeleteBtn}
              >
                <Trash2 size={14} color={Colors.dangerText} />
              </Pressable>
            </View>
          ))}

          <View style={[styles.chargeRow, styles.chargeTotalRow]}>
            <Text style={styles.chargeTotalLabel}>Total Other Charges</Text>
            <Text style={styles.chargeTotalValue}>{formatInr(total)}</Text>
          </View>
        </>
      ) : null}

      {/* Add Charge Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={closeAddModal}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-4 text-sm font-bold uppercase text-text-primary">Add Other Charge</Text>

            <View className="mb-4">
              <SearchableSelectDropdown compact
                label="Charge Name"
                value={selectedChargeName}
                options={chargeDropdownOptions}
                onChange={handleChargeNameSelect}
                placeholder="Select charge"
                searchPlaceholder="Search charge"
                containerClassName="w-full"
              />
            </View>

            <View className="mb-4">
              <FieldLabel label="Amount (₹)" required />
              <View className={`h-11 flex-row items-center rounded-input border px-3.5 ${
                errors.amount ? 'border-danger-text bg-danger-bg' : 'border-border bg-surface-input'
              }`}>
                <Text className="mr-1.5 text-sm font-medium text-text-muted">₹</Text>
                <TextInput
                  value={amountInput}
                  onChangeText={(text) => {
                    setAmountInput(sanitizeAmountInput(text));
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="number-pad"
                  className="flex-1 text-sm text-text-primary"
                />
              </View>
              {errors.amount ? (
                <Text className="mt-1 text-xs text-danger-text">{errors.amount}</Text>
              ) : null}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={closeAddModal}
                className="flex-1 items-center rounded-button border border-border bg-white py-3"
              >
                <Text className="text-sm font-semibold text-text-secondary">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCharge}
                className="flex-1 items-center rounded-button bg-primary py-3"
              >
                <Text className="text-sm font-semibold text-white">Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Charge Modal */}
      <Modal
        visible={customChargeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCustomChargeModal}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-4 text-sm font-bold uppercase text-text-primary">
              Add Custom Charge
            </Text>

            <View className="mb-4">
              <FieldLabel label="Charge Name" required />
              <TextInput
                value={customChargeInput}
                onChangeText={(text) => {
                  setCustomChargeInput(text);
                  if (errors.customName) setErrors((prev) => ({ ...prev, customName: undefined }));
                }}
                placeholderTextColor={Colors.placeholder}
                autoFocus
                className={`h-11 rounded-input border px-3.5 text-sm text-text-primary ${
                  errors.customName ? 'border-danger-text bg-danger-bg' : 'border-border bg-surface-input'
                }`}
              />
              {errors.customName ? (
                <Text className="mt-1 text-xs text-danger-text">{errors.customName}</Text>
              ) : null}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={closeCustomChargeModal}
                disabled={savingCustomCharge}
                className="flex-1 items-center rounded-button border border-border bg-white py-3 disabled:opacity-50"
              >
                <Text className="text-sm font-semibold text-text-secondary">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCustomCharge}
                disabled={savingCustomCharge}
                className="flex-1 items-center rounded-button bg-primary py-3 disabled:opacity-60"
              >
                <Text className="text-sm font-semibold text-white">
                  {savingCustomCharge ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

/* Mockup .charges-tile / .add-charge-btn / .charge-row (styles.css 1415-1436) */
const styles = StyleSheet.create({
  chargesTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  chargesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chargesTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addChargeBtn: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.button,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addChargeBtnDisabled: {
    opacity: 0.5,
  },
  addChargeBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  addChargeBtnText: {
    fontSize: 11.8,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  chargeRowBox: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chargeRowName: {
    flexShrink: 1,
    fontSize: 12.8,
    color: Colors.textPrimary,
  },
  chargeRowAmount: {
    fontSize: 12.8,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chargeDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,31,23,0.3)',
    backgroundColor: Colors.dangerBg,
  },
  chargeTotalRow: {
    justifyContent: 'space-between',
  },
  chargeTotalLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  chargeTotalValue: {
    fontSize: 12.8,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
});
