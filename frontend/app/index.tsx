import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, type Href } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { REMEMBERED_PHONE_KEY } from '@/utils/clearAppState';

/**
 * Where a cold start lands.
 *
 * A phone this shop has signed in on before goes to Login, which greets them
 * with their own number and the MPIN boxes — the remembered number survives
 * new builds under its own spared key, so an update is four digits, not a
 * form. Only a phone that has never signed in opens on Create New Account,
 * the mockup's onboarding: an invitation to make an account rather than a
 * demand for credentials it does not have yet.
 *
 * Nobody is stranded either way: signup's foot has "Log in", and Login's
 * "Forgot MPIN?" and number-change links cover the rest.
 */
export default function Index() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const savedPhone = useAuthStore((s) => s.savedPhone);
  const [rememberedKnown, setRememberedKnown] = useState<boolean | null>(null);

  // The spared key outlives the build wipe that empties the store, so it is
  // what says "this phone knows a shop" on the first start after an update.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(REMEMBERED_PHONE_KEY)
      .then((stored) => {
        if (!cancelled) setRememberedKnown(Boolean(stored && stored.replace(/\D/g, '').length === 10));
      })
      .catch(() => {
        if (!cancelled) setRememberedKnown(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wait for the persisted session before choosing a destination, otherwise a
  // signed-in user briefly lands on signup before the guard bounces them back.
  if (!hasHydrated || rememberedKnown === null) return null;

  const knowsShop = rememberedKnown || savedPhone.replace(/\D/g, '').length === 10;

  // The cast is how the rest of the app addresses this route: expo-router's
  // generated union covers /register/* but not the group's own index.
  const destination = isAuthenticated ? '/dashboard' : knowsShop ? '/login' : '/register';
  return <Redirect href={destination as Href} />;
}
