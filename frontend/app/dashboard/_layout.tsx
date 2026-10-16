import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStore } from '@/store/employeeStore';
import { useMatricesStore } from '@/store/matricesStore';
import { fetchEmployees } from '@/utils/employeeApi';

export default function DashboardLayout() {
  const fetchValues = useMatricesStore((s) => s.fetchValues);
  const setEmployees = useEmployeeStore((s) => s.setEmployees);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.userRole);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchValues();
  }, [fetchValues, isAuthenticated]);

  useEffect(() => {
    // An employee's roster store starts empty in their own storage scope —
    // the shop roster lives in the owner's — so their permission gates
    // (settings tiles, rate editing, home matrices) had nothing to read.
    // The backend hands an employee exactly their own record here.
    if (!isAuthenticated || userRole !== 'employee') return;
    void fetchEmployees()
      .then((result) => {
        if (result.success && result.data) setEmployees(result.data);
      })
      .catch(() => {
        // Offline or an older backend (owner-only route): gates keep their
        // conservative defaults until the next dashboard entry retries.
      });
  }, [isAuthenticated, userRole, setEmployees]);

  // Declarative guard: rendered inside the navigator, so it can never fire
  // before the root layout has mounted.
  if (!hasHydrated) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="business-profile" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard-matrices" />
      <Stack.Screen name="market-rates" />
      <Stack.Screen name="masters/index" />
      <Stack.Screen name="inventory" options={{ headerShown: false }} />
      <Stack.Screen name="employees" options={{ headerShown: false }} />
      <Stack.Screen name="password-manager" />
      <Stack.Screen name="purity-control" />
      <Stack.Screen name="subscription-manager" />
      <Stack.Screen name="purchase-license" />
      <Stack.Screen name="credit-history" />
      <Stack.Screen name="scanner" options={{ headerShown: false }} />
      <Stack.Screen name="wishlist/index" options={{ headerShown: false }} />
    </Stack>
  );
}
