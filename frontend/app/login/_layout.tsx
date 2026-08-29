import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function LoginLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // An already-signed-in user never sees the login stack.
  if (isAuthenticated) return <Redirect href="/dashboard" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="forgot-user-id" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
