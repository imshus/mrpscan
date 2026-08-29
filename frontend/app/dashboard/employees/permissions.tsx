import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { MatrixCheckboxRow } from '@/components/settings/MatrixCheckboxRow';
import { GOLD_MATRIX_SECTIONS } from '@/constants/dashboardMatrices';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import type { EmployeePermissionKey } from '@/types/employee';
import type { MatrixKey } from '@/constants/dashboardMatrices';
import { buildEmployeeDraftPayload, createEmployeeDraft, updateEmployeeApi } from '@/utils/employeeApi';

const ACCENT_GOLD = Colors.metalGold;

export default function EmployeePermissionsScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const permissions = draft.permissions;
  const togglePermission = useEmployeeDraftStore((s) => s.togglePermission);
  const setPermissions = useEmployeeDraftStore((s) => s.setPermissions);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rateOptionError, setRateOptionError] = useState<string | null>(null);

  const toggle = (key: EmployeePermissionKey) => togglePermission(key);

  const resolveRateOption = () => {
    const allowRtgs = permissions.scan_rate_rtgs;
    const allowCash = permissions.scan_rate_cash;
    if (allowRtgs && allowCash) return 'both' as const;
    if (allowRtgs) return 'rtgs' as const;
    if (allowCash) return 'cash' as const;
    return null;
  };

  const applyRateOption = (option: 'rtgs' | 'cash' | 'both') => {
    setPermissions({
      ...permissions,
      scan_rate_rtgs: option === 'rtgs' || option === 'both',
      scan_rate_cash: option === 'cash' || option === 'both',
    });
    setRateOptionError(null);
  };

  const rateOption = resolveRateOption();

  const handleContinue = async () => {
    setFormError(null);

    if (!rateOption) {
      setRateOptionError('Select a gold rate option before continuing.');
      return;
    }
    setRateOptionError(null);

    if (mode === 'edit' && editEmployeeId) {
      setSaving(true);
      try {
        const result = await updateEmployeeApi(editEmployeeId, {
          name: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          permissions: permissions,
        });
        
        if (!result.success) {
          setFormError(result.error ?? 'Failed to update employee.');
          return;
        }

        updateEmployee(editEmployeeId, { permissions: { ...permissions } });
        router.replace(`/dashboard/employees/${editEmployeeId}` as Href);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const result = await createEmployeeDraft(buildEmployeeDraftPayload(draft));
      if (!result.success) {
        setFormError(result.error ?? 'Failed to save employee draft.');
        return;
      }
      router.push('/dashboard/employees/create-password' as Href);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title="Set Permissions" multiline={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dashboard Matrices</Text>
          <Text style={styles.cardSubtitle}>Price visibility on home screen</Text>

          <View style={styles.goldHeader}>
            <View style={styles.goldDot} />
            <Text style={styles.goldHeaderText}>GOLD BREAKDOWNS</Text>
          </View>

          {GOLD_MATRIX_SECTIONS.map((section) => (
            <View key={section.sectionLabel} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.sectionLabel}</Text>
              </View>
              {section.rows.map((row, index) => (
                <MatrixCheckboxRow
                  key={row.key}
                  label={row.label}
                  checked={permissions[row.key]}
                  onToggle={() => toggle(row.key)}
                  showDivider={index < section.rows.length - 1}
                />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.cardTitle}>Give Rate Edit Access</Text>
          <Text style={styles.cardSubtitle}>Allow employee to edit market rates</Text>
          
          <MatrixCheckboxRow
            label="Gold Rate"
            checked={permissions.edit_rate_gold}
            onToggle={() => toggle('edit_rate_gold')}
            showDivider
          />
          <MatrixCheckboxRow
            label="Diamond Rate"
            checked={permissions.edit_rate_diamond}
            onToggle={() => toggle('edit_rate_diamond')}
            showDivider
          />
          <MatrixCheckboxRow
            label="Colorstone Rate"
            checked={permissions.edit_rate_colorstone}
            onToggle={() => toggle('edit_rate_colorstone')}
            showDivider
          />
          <MatrixCheckboxRow
            label="Labour Charges"
            checked={permissions.edit_rate_labour}
            onToggle={() => toggle('edit_rate_labour')}
            showDivider={false}
          />
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.cardTitle}>Edit Purity Percentage During Calculation</Text>
          <Text style={styles.cardSubtitle}>
            Allow employee to modify the purity percentage while calculating jewellery price.
          </Text>
          <MatrixCheckboxRow
            label="Edit Purity (%)"
            checked={permissions.scan_edit_purity_percent}
            onToggle={() => toggle('scan_edit_purity_percent')}
            showDivider={false}
          />
        </View>

        <View style={styles.permissionCard}>
          <Text style={styles.cardTitle}>Gold Rate Options While Calculating</Text>
          <Text style={styles.cardSubtitle}>
            Choose which Gold Rate options the employee can use while calculating jewellery price.
          </Text>
          <View style={styles.radioGroup}>
            {[
              { value: 'rtgs', label: 'RTGS Rate Only' },
              { value: 'cash', label: 'Cash Rate Only' },
              { value: 'both', label: 'Both RTGS & Cash Rate' },
            ].map((option, index) => {
              const selected = rateOption === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.8}
                  onPress={() => applyRateOption(option.value as 'rtgs' | 'cash' | 'both')}
                  style={styles.radioRow}
                >
                  <Text style={styles.radioLabel}>{option.label}</Text>
                  <View
                    style={[
                      styles.radioOuter,
                      selected && styles.radioOuterSelected,
                    ]}
                  >
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                  {index < 2 ? <View style={styles.radioDivider} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {rateOptionError ? <Text style={styles.errorText}>{rateOptionError}</Text> : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleContinue}
          disabled={saving}
          style={saving ? styles.continueBtnDisabled : null}
        >
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.continueBtn}>
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </GradientView>
        </TouchableOpacity>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  permissionCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: 16,
    paddingBottom: 8,
    marginTop: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  goldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
  },
  goldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_GOLD,
  },
  goldHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT_GOLD,
    letterSpacing: 0.6,
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  continueBtn: {
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 5,
  },
  continueBtnDisabled: {
    opacity: 0.7,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandDeep,
    marginTop: 12,
    textAlign: 'center',
  },
  radioGroup: {
    marginTop: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  radioLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  radioOuterSelected: {
    borderColor: ACCENT_GOLD,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT_GOLD,
  },
  radioDivider: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: Colors.border,
  },
});
