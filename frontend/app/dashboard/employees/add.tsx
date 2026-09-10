import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { updateEmployeeApi } from '@/utils/employeeApi';
import { validateEmail, validatePhone } from '@/utils/validation';


export default function AddEmployeeScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const updateDraft = useEmployeeDraftStore((s) => s.updateDraft);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const handleContinue = async () => {
    const nextErrors = {
      fullName: !draft.fullName.trim() ? 'Full name is required' : null,
      phone: validatePhone(draft.phone),
      designation: !draft.designation.trim() ? 'Designation is required' : null,
      email: draft.email.trim() ? validateEmail(draft.email) : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (mode === 'edit' && editEmployeeId) {
      setSaving(true);
      try {
        const result = await updateEmployeeApi(editEmployeeId, {
          name: draft.fullName,
          phone: draft.phone,
          email: draft.email,
        });

        if (!result.success) {
          Alert.alert('Error', result.error ?? 'Failed to update employee details');
          return;
        }

        updateEmployee(editEmployeeId, {
          fullName: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          gender: draft.gender,
          designation: draft.designation,
        });
        router.back();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update employee');
      } finally {
        setSaving(false);
      }
      return;
    }

    router.push('/dashboard/employees/permissions' as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title={mode === 'edit' ? 'Edit Employee' : 'Add New Employee'} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sectionTitle}>EMPLOYEE DETAILS</Text>
            </View>
            <View style={styles.cardBody}>
            <Text style={styles.label}>
              Full Name<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={draft.fullName}
              onChangeText={(text) => updateDraft({ fullName: text })}
              accessibilityLabel="Full Name"
              placeholder="Employee Name"
              placeholderTextColor={Colors.placeholder}
              style={[styles.input, errors.fullName ? styles.inputError : null]}
            />
            {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

            <Text style={styles.label}>
              Phone Number<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={draft.phone}
              onChangeText={(text) =>
                updateDraft({ phone: text.replace(/\D/g, '').slice(0, 10) })
              }
              accessibilityLabel="Phone Number"
              placeholder="+91 9999999999"
              placeholderTextColor={Colors.placeholder}
              keyboardType="phone-pad"
              style={[styles.input, errors.phone ? styles.inputError : null]}
            />
            {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={draft.email}
              onChangeText={(text) => updateDraft({ email: text })}
              accessibilityLabel="Email"
              placeholder="employee@pratham.gmail.com"
              placeholderTextColor={Colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, errors.email ? styles.inputError : null]}
            />
            {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}

            <Text style={styles.label}>
              Position / Designation<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={draft.designation}
              onChangeText={(text) => updateDraft({ designation: text })}
              accessibilityLabel="Position or Designation"
              placeholder="Sales Manager"
              placeholderTextColor={Colors.placeholder}
              style={[styles.input, errors.designation ? styles.inputError : null]}
            />
            {errors.designation ? <Text style={styles.error}>{errors.designation}</Text> : null}
            </View>
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
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHead: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cardBody: {
    padding: 16,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandDeep,
    marginBottom: 7,
    marginTop: 14,
  },
  required: {
    color: Colors.brandDeep,
  },
  input: {
    minHeight: 50,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: Colors.brandDeep,
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandDeep,
    marginTop: 6,
  },
  continueBtn: {
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
});
