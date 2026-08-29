import { Stack } from 'expo-router';

import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';

export default function BusinessProfileLayout() {
  const allowed = useRequireSettingsAccess('business');
  if (!allowed) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
