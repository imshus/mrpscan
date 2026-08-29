import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function RegisterLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Signing in at the end of registration lands the user on the dashboard.
  if (isAuthenticated) return <Redirect href="/dashboard" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="gst" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="otp-phone" />
      <Stack.Screen name="password" />
    </Stack>
  );
}
