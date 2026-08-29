import { Stack } from 'expo-router';

import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

export default function InventoryLayout() {
  const allowed = useRequireSettingsAccess('inventory');
  if (!allowed) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bulk-upload" />
    </Stack>
  );
}
