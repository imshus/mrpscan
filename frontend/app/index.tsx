import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, type Href } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { REMEMBERED_PHONE_KEY } from '@/utils/clearAppState';

/**
 * Where a cold start lands.
 *
 * Signed in goes to the dashboard. A phone that has signed a shop in before
 * opens on Log In, greeted by its own number with only the MPIN to type. A
 * phone that has never signed anyone in opens on Create New Account, which is
 * the first thing a new shop should see.
 *
 * That last branch was removed for one build and is back on purpose. It was
 * never the wrong rule — what was wrong was the answer it got. The auth store
 * used to erase the remembered number on every build change while the install
 * wipe was deliberately sparing it, so "has this phone signed anyone in?" came
 * back false on every single update and shops that had an account were handed
 * a signup form. The store no longer erases it, so the question is answered
 * honestly and each side lands where it belongs.
 *
 * Nobody is stranded either way: signup's foot has "Log in", and Log In's has
 * "Create an account".
 */
export default function Index() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const savedPhone = useAuthStore((s) => s.savedPhone);
  const [rememberedKnown, setRememberedKnown] = useState<boolean | null>(null);

  // The spared key outlives the wipe that empties the stores on a new build,
  // so it is what says "this phone knows a shop" on the first start after an
  // update — the store itself is empty at that moment.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(REMEMBERED_PHONE_KEY)
      .then((stored) => {
        if (!cancelled) {
          setRememberedKnown(Boolean(stored && stored.replace(/\D/g, '').length === 10));
        }
      })
      .catch(() => {
        // Unreadable storage must not send a returning shop to signup, so the
        // benefit of the doubt goes to Log In, which can still reach signup.
        if (!cancelled) setRememberedKnown(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wait for both answers before choosing, otherwise a signed-in user flashes
  // through signup before the guard bounces them back.
  if (!hasHydrated || rememberedKnown === null) return null;

  const knowsShop = rememberedKnown || savedPhone.replace(/\D/g, '').length === 10;

  // The cast is how the rest of the app addresses this route: expo-router's
  // generated union covers the groups' children but not their own index.
  const destination = isAuthenticated ? '/dashboard' : knowsShop ? '/login' : '/register';
  return <Redirect href={destination as Href} />;
}
