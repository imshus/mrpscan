import { create } from 'zustand';

import { DEFAULT_EMPLOYEE_PERMISSIONS } from '@/constants/employeeData';
import type { EmployeeDraft, EmployeeGender, EmployeePermissionKey } from '@/types/employee';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

interface EmployeeDraftState {
  mode: 'add' | 'edit';
  editEmployeeId: string | null;
  draft: EmployeeDraft;
  setMode: (mode: 'add' | 'edit', employeeId?: string | null) => void;
  updateDraft: (data: Partial<EmployeeDraft>) => void;
  togglePermission: (key: EmployeePermissionKey) => void;
  setPermissions: (permissions: EmployeeDraft['permissions']) => void;
  resetDraft: () => void;
}

const emptyDraft: EmployeeDraft = {
  fullName: '',
  phone: '',
  email: '',
  gender: 'Male',
  designation: '',
  permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  password: '',
  confirmPassword: '',
};

export const useEmployeeDraftStore = create<EmployeeDraftState>()((set) => ({
  mode: 'add',
  editEmployeeId: null,
  draft: { ...emptyDraft, permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS } },
  setMode: (mode, employeeId = null) => set({ mode, editEmployeeId: employeeId }),
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
  resetDraft: () =>
    set({
      mode: 'add',
      editEmployeeId: null,
      draft: { ...emptyDraft, permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS } },
    }),
}));

/**
 * The half-filled form belongs to whoever was signing in when it was typed.
 * It lives in memory, so nothing on disk carries it over, but the app is not
 * restarted between accounts on a shared phone: signing in as someone else
 * must not open Add New Employee on the last person's colleague.
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
  password: string;
  permissions: EmployeeDraft['permissions'];
}) {
  useEmployeeDraftStore.getState().updateDraft({
    fullName: employee.fullName,
    phone: employee.phone,
    email: employee.email,
    gender: employee.gender,
    designation: employee.designation,
    password: employee.password,
    confirmPassword: employee.password,
    permissions: { ...employee.permissions },
  });
}
