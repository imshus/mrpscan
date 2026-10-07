import { create } from 'zustand';

import { DEFAULT_EMPLOYEE_PERMISSIONS } from '@/constants/employeeData';
import type { EmployeeDraft, EmployeeGender, EmployeePermissionKey } from '@/types/employee';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

/**
 * The login MPIN the owner is setting for a new employee, between Employee
 * Credentials and the create on Set Permissions.
 *
 * Kept beside the draft rather than in it, and this store is never persisted:
 * the four digits live in memory only, for as long as the add flow is open,
 * and are wiped with the draft (on create, on Add, on edit, on an account
 * switch).
 */
export interface EmployeeCredentialsDraft {
  mpin: string;
  confirmMpin: string;
}

interface EmployeeDraftState {
  mode: 'add' | 'edit';
  editEmployeeId: string | null;
  draft: EmployeeDraft;
  credentials: EmployeeCredentialsDraft;
  /**
   * A number the server said is already someone's login. Add New Employee
   * shows "This number is already registered" under the phone while the
   * draft still holds it; changing the number clears it by itself.
   */
  takenPhone: string | null;
  setMode: (mode: 'add' | 'edit', employeeId?: string | null) => void;
  updateDraft: (data: Partial<EmployeeDraft>) => void;
  togglePermission: (key: EmployeePermissionKey) => void;
  setPermissions: (permissions: EmployeeDraft['permissions']) => void;
  setCredentials: (data: Partial<EmployeeCredentialsDraft>) => void;
  setTakenPhone: (phone: string | null) => void;
  resetDraft: () => void;
}

const emptyDraft: EmployeeDraft = {
  fullName: '',
  phone: '',
  email: '',
  gender: 'Male',
  designation: '',
  permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
};

const emptyCredentials: EmployeeCredentialsDraft = { mpin: '', confirmMpin: '' };

export const useEmployeeDraftStore = create<EmployeeDraftState>()((set) => ({
  mode: 'add',
  editEmployeeId: null,
  draft: { ...emptyDraft, permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS } },
  credentials: { ...emptyCredentials },
  takenPhone: null,
  // Editing someone never carries a half-set MPIN for a new hire along.
  setMode: (mode, employeeId = null) =>
    set(
      mode === 'edit'
        ? { mode, editEmployeeId: employeeId, credentials: { ...emptyCredentials }, takenPhone: null }
        : { mode, editEmployeeId: employeeId },
    ),
  updateDraft: (data) => set((state) => ({ draft: { ...state.draft, ...data } })),
  togglePermission: (key) =>
    set((state) => ({
      draft: {
        ...state.draft,
        permissions: {
          ...state.draft.permissions,
          [key]: !state.draft.permissions[key],
        },
      },
    })),
  setPermissions: (permissions) =>
    set((state) => ({ draft: { ...state.draft, permissions } })),
  setCredentials: (data) =>
    set((state) => ({ credentials: { ...state.credentials, ...data } })),
  setTakenPhone: (phone) => set({ takenPhone: phone }),
  resetDraft: () =>
    set({
      mode: 'add',
      editEmployeeId: null,
      draft: { ...emptyDraft, permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS } },
      credentials: { ...emptyCredentials },
      takenPhone: null,
    }),
}));

/**
 * The half-filled form belongs to whoever was signing in when it was typed.
 * It lives in memory, so nothing on disk carries it over, but the app is not
 * restarted between accounts on a shared phone: signing in as someone else
 * must not open Add New Employee on the last person's colleague — or hand
 * them the MPIN that was being set for them.
 */
registerScopeResetCallback(() => {
  useEmployeeDraftStore.getState().resetDraft();
});

export function loadEmployeeIntoDraft(employee: {
  fullName: string;
  phone: string;
  email: string;
  gender: EmployeeGender;
  designation: string;
  permissions: EmployeeDraft['permissions'];
}) {
  useEmployeeDraftStore.getState().updateDraft({
    fullName: employee.fullName,
    phone: employee.phone,
    email: employee.email,
    gender: employee.gender,
    designation: employee.designation,
    permissions: { ...employee.permissions },
  });
}
