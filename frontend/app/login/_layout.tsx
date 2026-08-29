import { Stack } from 'expo-router';

export default function LoginLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="forgot-user-id" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
