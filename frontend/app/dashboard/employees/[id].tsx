import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { DeleteEmployeeModal } from '@/components/employees/DeleteEmployeeModal';
import { EmployeeInfoCard } from '@/components/employees/EmployeeInfoCard';
import { EmployeePermissionsPreview } from '@/components/employees/EmployeePermissionsPreview';
import { EmployeeProfileHeader } from '@/components/employees/EmployeeProfileHeader';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { loadEmployeeIntoDraft, useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { updateEmployeeApi } from '@/utils/employeeApi';

export default function EmployeeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const employee = useEmployeeStore((s) => s.employees.find((e) => e.id === id));
  const removeEmployee = useEmployeeStore((s) => s.removeEmployee);
  const updateEmployeeStore = useEmployeeStore((s) => s.updateEmployee);
  const setMode = useEmployeeDraftStore((s) => s.setMode);

  const [showDelete, setShowDelete] = useState(false);
  const [togglingRevoke, setTogglingRevoke] = useState(false);

  if (!employee) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <EmployeeScreenHeader title="Employee Management" multiline={false} />
      </SafeAreaView>
    );
  }

  const startEdit = (target: 'profile' | 'password' | 'permissions') => {
    loadEmployeeIntoDraft(employee);
    setMode('edit', employee.id);

    if (target === 'profile') {
      router.push('/dashboard/employees/add' as Href);
    } else if (target === 'password') {
      router.push('/dashboard/employees/create-password' as Href);
    } else {
      router.push('/dashboard/employees/permissions' as Href);
    }
  };

  const handleDelete = async () => {
    try {
      await removeEmployee(employee.id);
      setShowDelete(false);
      router.back();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete employee.';
      Alert.alert('Error', msg);
    }
  };

  const handleToggleRevoke = async (newValue: boolean) => {
    if (togglingRevoke) return;
    setTogglingRevoke(true);
    try {
      const result = await updateEmployeeApi(employee.id, { isActive: newValue });
      if (result.success) {
        updateEmployeeStore(employee.id, { isActive: newValue });
      } else {
        Alert.alert('Error', result.error || 'Failed to update account status.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update account status.';
      Alert.alert('Error', msg);
    } finally {
      setTogglingRevoke(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title="Employee Management" multiline={false} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <EmployeeProfileHeader
          employee={employee}
          onEdit={() => startEdit('profile')}
          onDelete={() => setShowDelete(true)}
        />

        <EmployeeInfoCard
          title="EMPLOYEE DETAILS"
          rows={[
            { label: 'Name', value: employee.fullName },
            { label: 'Designation', value: employee.designation },
            { label: 'Phone No.', value: `+91 ${employee.phone}` },
            { label: 'Email', value: employee.email },
          ]}
        />

        <EmployeeInfoCard
          title="PASSWORD MANAGER"
          actionLabel="Employee Password"
          actionValue={employee.password}
          onEdit={() => startEdit('password')}
        />

        <EmployeePermissionsPreview onEdit={() => startEdit('permissions')} />

        <View style={styles.revokeSection}>
          <Text style={styles.revokeTitle}>ACCOUNT STATUS</Text>
          <View style={styles.revokeCard}>
            <View style={styles.revokeInfo}>
              <Text style={styles.revokeCardTitle}>
                {employee.isActive === false ? 'Account Revoked' : 'Active Account'}
              </Text>
              <Text style={styles.revokeCardDesc}>
                {employee.isActive === false
                  ? 'This employee is currently unable to login.'
                  : 'Toggle to instantly revoke login access for this employee.'}
              </Text>
            </View>
            <Switch
              value={employee.isActive !== false}
              onValueChange={handleToggleRevoke}
              disabled={togglingRevoke}
              trackColor={{ false: Colors.border, true: Colors.metalGold }}
            />
          </View>
        </View>
      </ScrollView>

      <BottomNav activeRoute="home" />

      <DeleteEmployeeModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  revokeSection: {
    marginTop: 24,
  },
  revokeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  revokeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  revokeInfo: {
    flex: 1,
    paddingRight: 16,
  },
  revokeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  revokeCardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
