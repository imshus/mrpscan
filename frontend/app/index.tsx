import { Redirect, type Href } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

/**
 * Where a cold start lands.
 *
 * The mockup's onboarding opens on Create New Account: its splash hands over
 * to the signup screen, not to Login. So the first thing a new shop sees is an
 * invitation to make an account, rather than a demand for credentials it does
 * not have yet.
 *
 * Nobody is stranded by that. Anyone who already has an account taps "Log in"
 * at the foot of the signup screen, and a session that merely expired is sent
 * to Login by the dashboard guard rather than through here.
 */
export default function Index() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted session before choosing a destination, otherwise a
  // signed-in user briefly lands on signup before the guard bounces them back.
  if (!hasHydrated) return null;

  // The cast is how the rest of the app addresses this route: expo-router's
  // generated union covers /register/* but not the group's own index.
  return <Redirect href={(isAuthenticated ? '/dashboard' : '/register') as Href} />;
}
