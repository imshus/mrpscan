import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

/**
 * Mockup onboarding starts directly at Login (Splash → Login) —
 * the old "Get Started Now" landing screen was removed.
 */
export default function Index() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted session before choosing a destination, otherwise a
  // logged-in user briefly lands on Login before the guard bounces them back.
  if (!hasHydrated) return null;

  return <Redirect href={isAuthenticated ? '/dashboard' : '/login'} />;
}
