import { Stack } from 'expo-router';

import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

export default function EmployeesLayout() {
  const allowed = useRequireSettingsAccess('employee');
  if (!allowed) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="add" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="create-password" />
    </Stack>
  );
}
