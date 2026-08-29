import type { SettingsPermissionKey } from '@/types/employee';

/** Never visible to employees, regardless of owner permissions. */
export const OWNER_ONLY_SETTINGS_IDS = new Set(['employee', 'matrices', 'subscription']);

/** Always visible to employees in settings. */
export const EMPLOYEE_ALWAYS_SETTINGS_IDS = new Set(['password', 'logout']);

/** Optional settings items the owner can grant per employee. */
export const SETTINGS_PERMISSION_MAP: Partial<Record<string, SettingsPermissionKey>> = {
  formulae: 'settings_formulae',
  inventory: 'settings_inventory',
  tunch: 'settings_purity',
  invoice: 'settings_invoice',
};

export const SETTINGS_PERMISSION_ROWS: { key: SettingsPermissionKey; label: string }[] = [
  { key: 'settings_formulae', label: 'Manage Formulae' },
  { key: 'settings_inventory', label: 'Inventory Manager' },
  { key: 'settings_purity', label: 'Tunch (Purity) Control' },
  { key: 'settings_invoice', label: 'Invoice Formats' },
];
