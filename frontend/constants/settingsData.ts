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
  Lock,
  LogOut,
  Sigma,
  Trash2,
  TrendingUp,
  Type,
  UserPlus,
} from 'lucide-react-native';

export interface SettingsMenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  route?: string;
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
  // MPIN Manager took Password Manager's place, as the mockup's menu has it.
  // The password screen is still at /dashboard/password-manager, only no
  // longer listed.
  {
    id: 'mpin',
    title: 'MPIN Manager',
    icon: Lock,
    route: '/dashboard/mpin-manager',
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
