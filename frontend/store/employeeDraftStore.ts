import { create } from 'zustand';

import { DEFAULT_EMPLOYEE_PERMISSIONS } from '@/constants/employeeData';
import type { EmployeeDraft, EmployeeGender, EmployeePermissionKey } from '@/types/employee';
import { normalizeIndianPhone, type EmployeePhoneTransfer } from '@/utils/employeeCredentials';
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

/**
 * The number the employee proved with the OTP sent to it, and the token the
 * server gave for it. The server takes a new employee (or a changed number)
 * only with this token, for 30 minutes; in memory only, like the MPIN.
 */
export interface EmployeePhoneVerification {
  phone: string;
  token: string;
  verifiedAt: number;
}

/** A little under the server's 30 minutes, so a token is never sent as it lapses. */
const VERIFICATION_TTL_MS = 25 * 60 * 1000;

/**
 * The last OTP texted, so going back to Add and on again does not text a
 * second code (which would make the one the employee is reading out stop
 * working). A little under the code's 10-minute life.
 */
export interface EmployeeOtpSent {
  phone: string;
  sentAt: number;
}
const OTP_REUSE_MS = 9 * 60 * 1000;

/**
 * Whose login a number is, when the server moves it on the add (or the
 * number change): another shop's owner or employee, or another admin of this
 * shop. Verify Phone says so above the OTP boxes. It belongs to that number
 * only: once the draft holds a different one, it is gone.
 */
export interface EmployeePhoneTransferFor {
  phone: string;
  transfer: EmployeePhoneTransfer;
}

interface EmployeeDraftState {
  mode: 'add' | 'edit';
  editEmployeeId: string | null;
  draft: EmployeeDraft;
  credentials: EmployeeCredentialsDraft;
  /**
   * A number the server refused as already registered (an employee of this
   * shop, or a super admin's login). Add New Employee shows "This number is
   * already registered" under the phone while the draft still holds it;
   * changing the number clears it by itself.
   */
  takenPhone: string | null;
  /**
   * The owner's own number, which the server refuses as an employee's. Shown
   * under the phone the same way, while the draft still holds it.
   */
  ownPhone: string | null;
  phoneTransfer: EmployeePhoneTransferFor | null;
  phoneVerification: EmployeePhoneVerification | null;
  otpSent: EmployeeOtpSent | null;
  setMode: (mode: 'add' | 'edit', employeeId?: string | null) => void;
  updateDraft: (data: Partial<EmployeeDraft>) => void;
  togglePermission: (key: EmployeePermissionKey) => void;
  setPermissions: (permissions: EmployeeDraft['permissions']) => void;
  setCredentials: (data: Partial<EmployeeCredentialsDraft>) => void;
  setTakenPhone: (phone: string | null) => void;
  setOwnPhone: (phone: string | null) => void;
  setPhoneTransfer: (transfer: EmployeePhoneTransferFor | null) => void;
  setPhoneVerification: (verification: EmployeePhoneVerification | null) => void;
  setOtpSent: (sent: EmployeeOtpSent | null) => void;
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
  ownPhone: null,
  phoneTransfer: null,
  phoneVerification: null,
  otpSent: null,
  // Editing someone never carries a half-set MPIN, or a number proved for a
  // new hire, along.
  setMode: (mode, employeeId = null) =>
    set(
      mode === 'edit'
        ? {
            mode,
            editEmployeeId: employeeId,
            credentials: { ...emptyCredentials },
            takenPhone: null,
            ownPhone: null,
            phoneTransfer: null,
            phoneVerification: null,
            otpSent: null,
          }
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
  setOwnPhone: (phone) => set({ ownPhone: phone }),
  setPhoneTransfer: (transfer) => set({ phoneTransfer: transfer }),
  setPhoneVerification: (verification) => set({ phoneVerification: verification }),
  setOtpSent: (sent) => set({ otpSent: sent }),
  resetDraft: () =>
    set({
      mode: 'add',
      editEmployeeId: null,
      draft: { ...emptyDraft, permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS } },
      credentials: { ...emptyCredentials },
      takenPhone: null,
      ownPhone: null,
      phoneTransfer: null,
      phoneVerification: null,
      otpSent: null,
    }),
}));

/**
 * The token for `phone` when that exact number was proved by OTP recently
 * enough for the server to still accept it; null otherwise. A number changed
 * after it was proved is never verified.
 */
export function verifiedPhoneToken(
  verification: EmployeePhoneVerification | null,
  phone: string,
  now: number = Date.now(),
): string | null {
  if (!verification) return null;
  if (verification.phone !== normalizeIndianPhone(phone)) return null;
  if (now - verification.verifiedAt > VERIFICATION_TTL_MS) return null;
  return verification.token;
}

/** Whose login `phone` moves from, when that is what the server said of this exact number. */
export function transferForPhone(
  stored: EmployeePhoneTransferFor | null,
  phone: string,
): EmployeePhoneTransfer | null {
  return stored && stored.phone === normalizeIndianPhone(phone) ? stored.transfer : null;
}

/** Whether a code texted to `phone` is recent enough to still be the one in use. */
export function otpStillLive(
  sent: EmployeeOtpSent | null,
  phone: string,
  now: number = Date.now(),
): boolean {
  return !!sent && sent.phone === normalizeIndianPhone(phone) && now - sent.sentAt < OTP_REUSE_MS;
}

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
