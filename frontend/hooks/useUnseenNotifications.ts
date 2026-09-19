import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchNotifications } from '@/utils/notificationsApi';
import { scopedKey } from '@/utils/userScopedStorage';

const LAST_SEEN_KEY = 'notifications-last-seen';

/** Remembers that this account has now looked at the bell. */
export async function markNotificationsSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(scopedKey(LAST_SEEN_KEY), new Date().toISOString());
  } catch {
    // A dot that will not clear is a nuisance, not a fault worth surfacing.
  }
}

/**
 * Whether the bell has anything the shop has not opened yet (mockup's
 * `.dash-bell-dot`).
 *
 * Nothing server-side marks a notification read, so "unseen" is worked out
 * here: the newest notification against the last time this account opened the
 * screen. Kept per account — a shared phone must not clear one person's dot
 * because another read theirs — and a shop that has never opened it sees the
 * dot while anything is there at all.
 */
export function useUnseenNotifications(): boolean {
  const [unseen, setUnseen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        try {
          const [notifications, lastSeen] = await Promise.all([
            fetchNotifications(),
            AsyncStorage.getItem(scopedKey(LAST_SEEN_KEY)),
          ]);
          if (cancelled) return;

          const newest = notifications.reduce((latest, notification) => {
            const at = new Date(notification.at).getTime();
            return Number.isFinite(at) && at > latest ? at : latest;
          }, 0);
          if (newest === 0) {
            setUnseen(false);
            return;
          }

          const seenAt = lastSeen ? new Date(lastSeen).getTime() : 0;
          setUnseen(!Number.isFinite(seenAt) || newest > seenAt);
        } catch {
          // The bell is not worth an error on the home screen.
          if (!cancelled) setUnseen(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return unseen;
}
