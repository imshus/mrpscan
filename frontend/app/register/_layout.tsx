import { Stack } from 'expo-router';

export default function RegisterLayout() {
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
