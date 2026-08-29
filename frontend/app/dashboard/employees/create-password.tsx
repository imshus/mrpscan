import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { fetchEmployees, finalizeEmployeeCreation } from '@/utils/employeeApi';


export default function CreateEmployeePasswordScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const updateDraft = useEmployeeDraftStore((s) => s.updateDraft);
  const resetDraft = useEmployeeDraftStore((s) => s.resetDraft);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);

  const setEmployees = useEmployeeStore((s) => s.setEmployees);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    const nextErrors = {
      password: !draft.password.trim() ? 'Password is required' : null,
      confirmPassword:
        draft.password !== draft.confirmPassword ? 'Passwords do not match' : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      if (mode === 'edit' && editEmployeeId) {
        updateEmployee(editEmployeeId, {
          fullName: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          gender: draft.gender,
          designation: draft.designation,
          password: draft.password,
          permissions: draft.permissions,
        });
        resetDraft();
        router.replace(`/dashboard/employees/${editEmployeeId}` as Href);
        return;
      }

      const result = await finalizeEmployeeCreation(draft.password, draft);
      if (!result.success) {
        setFormError(result.error ?? 'Failed to create employee.');
        return;
      }

      const listResult = await fetchEmployees();
      if (listResult.success && listResult.data) {
        setEmployees(listResult.data);
      }

      resetDraft();
      router.replace('/dashboard/employees' as Href);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title={'Create\nPassword'} />

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
              <Text style={styles.sectionTitle}>CREATE PASSWORD FOR EMPLOYEE</Text>
            </View>
            <View style={styles.cardBody}>
            <Text style={styles.label}>Create Password</Text>
            <View style={[styles.inputRow, errors.password ? styles.inputError : null]}>
              <TextInput
                value={draft.password}
                onChangeText={(text) => updateDraft({ password: text })}
                placeholder="PASSWORD"
                placeholderTextColor={Colors.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                {showPassword ? (
                  <Eye size={20} color={Colors.textMuted} />
                ) : (
                  <EyeOff size={20} color={Colors.textMuted} />
                )}
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}

            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputRow, errors.confirmPassword ? styles.inputError : null]}>
              <TextInput
                value={draft.confirmPassword}
                onChangeText={(text) => updateDraft({ confirmPassword: text })}
                placeholder="••••••••"
                placeholderTextColor={Colors.placeholder}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
                {showConfirm ? (
                  <Eye size={20} color={Colors.textMuted} />
                ) : (
                  <EyeOff size={20} color={Colors.textMuted} />
                )}
              </Pressable>
            </View>
            {errors.confirmPassword ? (
              <Text style={styles.error}>{errors.confirmPassword}</Text>
            ) : null}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSubmit}
            disabled={saving}
            style={saving ? styles.submitBtnDisabled : null}
          >
            <GradientView colors={Gradients.brand} borderRadius={999} style={styles.submitBtn}>
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'edit' ? 'Update Password' : 'Add Employee'}
                </Text>
              )}
            </GradientView>
          </TouchableOpacity>
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
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
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 7,
    marginTop: 14,
  },
  inputRow: {
    minHeight: 50,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 12,
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
  submitBtn: {
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
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
