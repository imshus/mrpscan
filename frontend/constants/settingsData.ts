import type { LucideIcon } from 'lucide-react-native';
import {
  ClipboardCheck,
  Clock,
  Crown,
  FileText,
  Gift,
  Headset,
  HelpCircle,
  IdCard,
  LayoutGrid,
  LogOut,
  ShieldCheck,
  Sigma,
  Trash2,
  TrendingUp,
  Type,
  UserPlus,
} from 'lucide-react-native';

import { PRIVACY_POLICY_URL } from '@/constants/legal';

export interface SettingsMenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  route?: string;
  /** A web page opened in the in-app browser instead of a route. */
  url?: string;
  isLogout?: boolean;
  /** Drawn like Logout, in red, just above it. */
  isDeleteAccount?: boolean;
}

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  {
    id: 'matrices',
    title: 'Dashboard Settings',
    icon: LayoutGrid,
    route: '/dashboard/dashboard-matrices',
  },
  {
    id: 'masters',
    title: 'Masters',
    icon: TrendingUp,
    route: '/dashboard/masters',
  },
  // 'rate-control' (Rate Control Panel) is intentionally not listed — the
  // design-mockup settings menu does not have it. The route still exists
  // at /dashboard/rate-control; re-add an entry here to surface it again.
  {
    id: 'employee',
    title: 'Employee Manager',
    icon: UserPlus,
    route: '/dashboard/employees',
  },
  {
    id: 'history',
    title: 'History',
    icon: Clock,
    route: '/dashboard/history',
  },
  {
    id: 'subscription',
    title: 'Credits & Subscription',
    icon: Crown,
    route: '/dashboard/subscription-manager',
  },
  {
    id: 'invite',
    title: 'Earn & Invite',
    icon: Gift,
    route: '/dashboard/earn-invite',
  },
  {
    id: 'contact',
    title: 'Contact Us',
    icon: Headset,
    route: '/dashboard/contact-us',
  },
  {
    id: 'faqs',
    title: 'FAQs',
    icon: HelpCircle,
    route: '/dashboard/faqs',
  },
  // The App Store wants the privacy policy reachable inside the app
  // (guideline 5.1.1(i)), for owners and employees alike.
  {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: ShieldCheck,
    url: PRIVACY_POLICY_URL,
  },
  // Just above Logout, for owners and employees alike: only the person's own
  // login goes, the shop's records stay (app/dashboard/delete-account.tsx).
  {
    id: 'delete-account',
    title: 'Delete Account',
    icon: Trash2,
    route: '/dashboard/delete-account',
    isDeleteAccount: true,
  },
  {
    id: 'logout',
    title: 'Logout Session',
    icon: LogOut,
    isLogout: true,
  },
];
