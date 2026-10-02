import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/store/authStore';

/** Local midnight that began the current day, in ms. */
const startOfToday = (): number => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Signs the account out at 12:00 AM, every day — the shop's rule: a session
 * belongs to the day it was opened on.
 *
 * The server holds the rule for every device: tokens expire at midnight,
 * so the first request after it is refused and the app drops to Log In. This
 * hook is the phone's own copy of it, so the screen changes at once. With
 * the app open, a timer set for the coming midnight — and a check every
 * minute behind it — signs out on the stroke. With the app closed or in the
 * background, where timers do not run, the session's start is compared with
 * today's midnight whenever the app comes back. Signing out flips
 * isAuthenticated, and the dashboard's own guard takes the shop to Log In.
 */
export function useMidnightLogout(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionStartedAt = useAuthStore((s) => s.sessionStartedAt);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!isAuthenticated) return;

    // A session from before this rule existed has no start recorded; it is
    // taken to have started now, so it ends at the coming midnight like any
    // other rather than never.
    if (sessionStartedAt == null) {
      useAuthStore.setState({ sessionStartedAt: Date.now() });
      return;
    }

    const endIfStale = (): boolean => {
      if (sessionStartedAt < startOfToday()) {
        logout();
        return true;
      }
      return false;
    };
    if (endIfStale()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const armForMidnight = () => {
      if (timer) clearTimeout(timer);
      const nextMidnight = startOfToday() + DAY_MS;
      timer = setTimeout(logout, Math.max(1_000, nextMidnight - Date.now()));
    };
    armForMidnight();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (endIfStale()) return;
      armForMidnight();
    });

    // A timer can be held back while the screen is off or the phone dozes;
    // a check every minute catches a midnight that slipped past it.
    const poll = setInterval(endIfStale, 60_000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      subscription.remove();
    };
  }, [isAuthenticated, sessionStartedAt, logout]);
}
