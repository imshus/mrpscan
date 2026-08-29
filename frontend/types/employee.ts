import type { MatrixKey } from '@/constants/dashboardMatrices';

export type EmployeeGender = 'Male' | 'Female' | 'Other';

export type SettingsPermissionKey =
  | 'settings_formulae'
  | 'settings_inventory'
  | 'settings_purity'
  | 'settings_invoice';

export type ExtraPermissionKey =
  | 'upload_new_items'
  | 'delete_stock_items'
  | 'revoke_access';

export type RateEditPermissionKey =
  | 'edit_rate_gold'
  | 'edit_rate_diamond'
  | 'edit_rate_colorstone'
  | 'edit_rate_labour';

export type ScannerCalculationPermissionKey =
  | 'scan_edit_purity_percent'
  | 'scan_rate_rtgs'
  | 'scan_rate_cash';

export type EmployeePermissionKey =
  | MatrixKey
  | ExtraPermissionKey
  | SettingsPermissionKey
  | RateEditPermissionKey
  | ScannerCalculationPermissionKey;

export type EmployeePermissions = Record<EmployeePermissionKey, boolean>;

export interface Employee {
  id: string;
  fullName: string;
  designation: string;
  phone: string;
  email: string;
  gender: EmployeeGender;
  password: string;
  permissions: EmployeePermissions;
  isActive?: boolean;
}

export interface EmployeeDraft {
  fullName: string;
  phone: string;
  email: string;
  gender: EmployeeGender;
  designation: string;
  permissions: EmployeePermissions;
  password: string;
  confirmPassword: string;
}
