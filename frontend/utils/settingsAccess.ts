import { SETTINGS_MENU_ITEMS } from '@/constants/settingsData';
import {
  EMPLOYEE_ALWAYS_SETTINGS_IDS,
  OWNER_ONLY_SETTINGS_IDS,
  SETTINGS_PERMISSION_MAP,
} from '@/constants/settingsPermissions';
import type { Employee, EmployeePermissions } from '@/types/employee';
import type { UserRole } from '@/store/authStore';

export function resolveCurrentEmployee(
  employees: Employee[],
  loggedInEmployeeId: string | null,
  savedPhone: string,
  savedEmployeePhone: string,
): Employee | null {
  if (loggedInEmployeeId) {
    return employees.find((employee) => employee.id === loggedInEmployeeId) ?? null;
  }

  const normalizedPhone = (savedEmployeePhone || savedPhone).replace(/\D/g, '').slice(-10);
  if (!normalizedPhone) return null;

  return (
    employees.find(
      (employee) => employee.phone.replace(/\D/g, '').slice(-10) === normalizedPhone,
    ) ?? null
  );
}

export function canAccessSettingsItem(
  itemId: string,
  userRole: UserRole,
  permissions?: EmployeePermissions | null,
  isSuper: boolean = false,
): boolean {
  if (userRole !== 'employee') {
    // Non-employee: allowed by default, except for some SUPREME-only items
    if (itemId === 'rate-control') {
      return isSuper === true;
    }
    return true;
  }

  if (itemId === 'masters' || itemId === 'market-rates') {
    return (
      permissions?.edit_rate_gold === true ||
      permissions?.edit_rate_diamond === true ||
      permissions?.edit_rate_colorstone === true ||
      permissions?.edit_rate_labour === true ||
      permissions?.settings_formulae === true
    );
  }

  if (OWNER_ONLY_SETTINGS_IDS.has(itemId)) {
    return false;
  }

  if (EMPLOYEE_ALWAYS_SETTINGS_IDS.has(itemId)) {
    return true;
  }

  const permissionKey = SETTINGS_PERMISSION_MAP[itemId];
  if (!permissionKey) {
    return false;
  }

  return permissions?.[permissionKey] === true;
}

export function getVisibleSettingsMenuItems(
  userRole: UserRole,
  permissions?: EmployeePermissions | null,
  isSuper: boolean = false,
) {
  return SETTINGS_MENU_ITEMS.filter((item) => canAccessSettingsItem(item.id, userRole, permissions, isSuper));
}
