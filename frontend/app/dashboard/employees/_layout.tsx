import { Stack } from 'expo-router';

import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

export default function EmployeesLayout() {
  const allowed = useRequireSettingsAccess('employee');
  if (!allowed) return null;

  // Adding: add → verify-phone (OTP to the employee's SIM) → credentials
  // (the login MPIN) → permissions (creates). Editing a number: add →
  // verify-phone, which saves it.
  // The detail screen's MPIN pencil opens update-mpin.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="credentials" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="update-mpin" />
    </Stack>
  );
}
