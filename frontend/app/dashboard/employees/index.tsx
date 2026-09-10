import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeFab } from '@/components/employees/EmployeeFab';
import { EmployeeListCard } from '@/components/employees/EmployeeListCard';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { EmployeeSearchBar } from '@/components/employees/EmployeeSearchBar';
import { Colors, Spacing } from '@/constants/theme';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { loadEmployeeIntoDraft, useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { fetchEmployees } from '@/utils/employeeApi';

export default function EmployeesScreen() {
  const router = useRouter();
  // An employee sees only their own record here; adding is the owner's.
  const { userRole } = useSettingsAccess();
  const isOwner = userRole !== 'employee';
  const employees = useEmployeeStore((s) => s.employees);
  const setEmployees = useEmployeeStore((s) => s.setEmployees);
  const resetEmployeeDraft = useEmployeeDraftStore((s) => s.resetDraft);
  const setMode = useEmployeeDraftStore((s) => s.setMode);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await fetchEmployees();
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        setError(result.error ?? 'Failed to load employees.');
      }
    } finally {
      setLoading(false);
    }
  }, [setEmployees]);

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
    }, [loadEmployees]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const handleAdd = () => {
    resetEmployeeDraft();
    setMode('add');
    router.push('/dashboard/employees/add' as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title={'Employee\nManagement'} />

      <View style={styles.searchWrap}>
        <EmployeeSearchBar value={search} onChangeText={setSearch} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.textPrimary} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No employees found.</Text>
        ) : (
          filtered.map((employee) => (
            <EmployeeListCard
              key={employee.id}
              employee={employee}
              onPress={() => router.push(`/dashboard/employees/${employee.id}` as Href)}
              onSetPermission={
                isOwner
                  ? () => {
                      // Straight to the permissions from the list: the whole
                      // set opens against this employee's saved values.
                      loadEmployeeIntoDraft(employee);
                      setMode('edit', employee.id);
                      router.push('/dashboard/employees/permissions' as Href);
                    }
                  : undefined
              }
            />
          ))
        )}
      </ScrollView>

      {isOwner ? (
        <View style={styles.fabWrap}>
          <EmployeeFab onPress={handleAdd} />
        </View>
      ) : null}

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchWrap: {
    paddingHorizontal: Spacing.screenHorizontal,
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  // Mockup: the Add pill sits at the right, above the bottom bar.
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: Spacing.screenHorizontal,
    bottom: 108,
    alignItems: 'flex-end',
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: Colors.dangerText,
    textAlign: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
