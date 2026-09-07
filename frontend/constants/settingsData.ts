import type { LucideIcon } from 'lucide-react-native';
import {
  ClipboardCheck,
  Crown,
  FileText,
  Gift,
  Headset,
  IdCard,
  LayoutGrid,
  Lock,
  LogOut,
  Sigma,
  TrendingUp,
  Type,
  UserPlus,
} from 'lucide-react-native';

/** What a tile does when it has no screen of its own. */
export type SettingsMenuAction = 'invite';

export interface SettingsMenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  route?: string;
  action?: SettingsMenuAction;
  isLogout?: boolean;
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
  // design-mockup settings menu has exactly six items. The route still exists
  // at /dashboard/rate-control; re-add an entry here to surface it again.
  {
    id: 'employee',
    title: 'Employee Manager',
    icon: UserPlus,
    route: '/dashboard/employees',
  },
  {
    id: 'password',
    title: 'Password Manager',
    icon: Lock,
    route: '/dashboard/password-manager',
  },
  {
    id: 'subscription',
    title: 'Credits & Subscription',
    icon: Crown,
    route: '/dashboard/subscription-manager',
  },
  {
    id: 'contact',
    title: 'Contact Us',
    icon: Headset,
    route: '/dashboard/contact-us',
  },
  {
    id: 'invite',
    title: 'Earn & Invite',
    icon: Gift,
    action: 'invite',
  },
  {
    id: 'logout',
    title: 'Logout Session',
    icon: LogOut,
    isLogout: true,
  },
];
