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
 * Two ways a session can cross midnight. With the app open, a timer set for
 * the coming midnight signs out on the stroke. With the app closed or in the
 * background — where JavaScript timers do not run — the session's start is
 * compared with today's midnight whenever the app comes back, so a session
 * opened yesterday ends on the first screen it would have shown. Signing
 * out flips isAuthenticated, and the dashboard's own guard takes the shop
 * to Log In.
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

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [isAuthenticated, sessionStartedAt, logout]);
}
