import { Stack } from 'expo-router';

import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

export default function EmployeesLayout() {
  const allowed = useRequireSettingsAccess('employee');
  if (!allowed) return null;

  // Adding: add → credentials (the login MPIN) → permissions (creates).
  // The detail screen's MPIN pencil opens update-mpin.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" />
      <Stack.Screen name="credentials" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="update-mpin" />
    </Stack>
  );
}
