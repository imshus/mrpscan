import { Redirect, type Href } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

/**
 * Where a cold start lands.
 *
 * Signed in goes to the dashboard; everyone else opens on Log In. It used to
 * route a phone with no remembered number to Create New Account instead, and
 * that was wrong twice over: a shop reinstalling, or one whose number the
 * store had dropped, was met by a signup form for an account it already had.
 * Log In carries "New to MRPscan? Create an account" in its foot, so a genuine
 * new shop is one tap away, while a returning one is never asked to register
 * again.
 *
 * The screen still greets the shop by its own number when this phone knows it
 * — Log In reads the spared key on mount — so an update is four digits, not a
 * form, and a device that knows nothing simply shows the number field.
 */
export default function Index() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted session before choosing a destination, otherwise a
  // signed-in user briefly lands on login before the guard bounces them back.
  if (!hasHydrated) return null;

  // The cast is how the rest of the app addresses this route: expo-router's
  // generated union covers the groups' children but not their own index.
  const destination = isAuthenticated ? '/dashboard' : '/login';
  return <Redirect href={destination as Href} />;
}
