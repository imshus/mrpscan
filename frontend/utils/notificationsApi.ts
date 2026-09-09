import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

export type NotificationKind =
  | 'referral_purchase'
  | 'referral_invite'
  | 'license_purchased'
  | 'credits_purchased'
  | 'low_credit'
  | 'trial_ending';

export interface NotificationSegment {
  text: string;
  bold?: boolean;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  segments: NotificationSegment[];
  at: string;
}

/** The bell's feed, newest first, derived server-side from real events. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const response = await apiRequest<Record<string, unknown>>('/notifications', { method: 'GET' });
  const data = unwrapApiData(response) as { notifications?: unknown };
  const rows = Array.isArray(data.notifications) ? data.notifications : [];
  return rows
    .map((raw): AppNotification | null => {
      const row = raw as Partial<AppNotification>;
      if (!row || !row.id || !Array.isArray(row.segments)) return null;
      return {
        id: String(row.id),
        kind: (row.kind as NotificationKind) || 'low_credit',
        segments: (row.segments as Partial<NotificationSegment>[])
          .map((seg) => ({ text: String(seg?.text ?? ''), bold: Boolean(seg?.bold) }))
          .filter((seg) => seg.text.length > 0),
        at: String(row.at ?? ''),
      };
    })
    .filter((row): row is AppNotification => row !== null);
}

/** "2 hours ago" from an ISO timestamp, the way the feed labels time. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}
