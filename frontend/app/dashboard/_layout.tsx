import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useMatricesStore } from '@/store/matricesStore';

export default function DashboardLayout() {
  const fetchValues = useMatricesStore((s) => s.fetchValues);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchValues();
  }, [fetchValues, isAuthenticated]);

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
      <Stack.Screen name="masters/rates" />
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
