import { DEFAULT_EMPLOYEE_PERMISSIONS } from '@/constants/employeeData';
import { DEFAULT_MATRIX_VALUES } from '@/constants/dashboardMatrices';
import type { MatrixKey } from '@/constants/dashboardMatrices';
import type { Employee, EmployeePermissions } from '@/types/employee';
import { apiRequest, ApiError } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';
import {
  normalizeIndianPhone,
  readPhoneTransfer,
  type EmployeePhoneTransfer,
} from '@/utils/employeeCredentials';

type ApiEnvelope<T extends Record<string, unknown>> = T & {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
};

export type ApiEmployeePermissions = {
  businessDetails: boolean;
  manageFormulae: boolean;
  homeDashboardMetricsControls: boolean;
  inventoryManager: boolean;
  employeeManager: boolean;
  tunchPurity: boolean;
  invoiceFormat: boolean;
  editRateGold: boolean;
  editRateDiamond: boolean;
  editRateColorstone: boolean;
  editRateLabour: boolean;
  scanEditPurityPercent?: boolean;
  scanRateRtgs?: boolean;
  scanRateCash?: boolean;
} & Partial<Record<MatrixKey, boolean>>;

const MATRIX_KEYS = Object.keys(DEFAULT_MATRIX_VALUES) as MatrixKey[];

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function unwrapEnvelope<T extends Record<string, unknown>>(response: ApiEnvelope<T>): T {
  return unwrapApiData(response) as T;
}

function isSuccessfulResponse(
  response: ApiEnvelope<Record<string, unknown>>,
  unwrapped: Record<string, unknown>,
): boolean {
  const unwrappedSuccess = unwrapped.success;
  if (typeof unwrappedSuccess === 'boolean') return unwrappedSuccess;
  if (typeof response.success === 'boolean') return response.success;
  return true;
}

function resolveApiMessage(
  response: ApiEnvelope<Record<string, unknown>>,
  unwrapped: Record<string, unknown>,
  fallback: string,
): string {
  return (
    readString(unwrapped, ['message', 'error']) ??
    readString(response as Record<string, unknown>, ['message', 'error']) ??
    fallback
  );
}

/** Error codes the employee screens act on, rather than just print. */
export const EMPLOYEE_ERROR_CODES = {
  phoneTaken: 'PHONE_ALREADY_REGISTERED',
  /** The number is the signed-in owner's own login. */
  ownNumber: 'OWN_NUMBER',
  trialRequired: 'TRIAL_REQUIRED_FOR_MORE_EMPLOYEES',
  /** The add or number change came without a valid OTP token (or it expired). */
  phoneNotVerified: 'EMPLOYEE_PHONE_NOT_VERIFIED',
} as const;

export interface EmployeeApiFailure {
  success: false;
  /** The server's own code (`error` in its body), e.g. PHONE_ALREADY_REGISTERED. */
  code?: string;
  /** HTTP status; absent when the request never got an answer. */
  status?: number;
  error: string;
}

/**
 * A server code is an UPPER_SNAKE word; anything else in `error` (or check
 * phone's `reason`) is prose.
 */
function readErrorCode(body: unknown, key = 'error'): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value) ? value : undefined;
}

function toFailure(error: unknown, fallback: string): EmployeeApiFailure {
  if (error instanceof ApiError) {
    return {
      success: false,
      code: readErrorCode(error.body),
      status: error.status,
      error: error.message || fallback,
    };
  }
  return { success: false, error: fallback };
}

function envelopeFailure(
  response: ApiEnvelope<Record<string, unknown>>,
  unwrapped: Record<string, unknown>,
  fallback: string,
): EmployeeApiFailure {
  return {
    success: false,
    code: readErrorCode(unwrapped) ?? readErrorCode(response),
    error: resolveApiMessage(response, unwrapped, fallback),
  };
}

export function mapDraftPermissionsToApi(permissions: EmployeePermissions): ApiEmployeePermissions {
  const hasMatrixAccess = MATRIX_KEYS.some((key) => permissions[key]);

  return {
    ...MATRIX_KEYS.reduce((acc, key) => ({ ...acc, [key]: permissions[key] }), {} as Record<MatrixKey, boolean>),
    businessDetails: false,
    manageFormulae: permissions.settings_formulae,
    homeDashboardMetricsControls: hasMatrixAccess,
    inventoryManager: permissions.settings_inventory,
    employeeManager: false,
    tunchPurity: permissions.settings_purity,
    invoiceFormat: permissions.settings_invoice,
    editRateGold: permissions.edit_rate_gold,
    editRateDiamond: permissions.edit_rate_diamond,
    editRateColorstone: permissions.edit_rate_colorstone,
    editRateLabour: permissions.edit_rate_labour,
    scanEditPurityPercent: permissions.scan_edit_purity_percent,
    scanRateRtgs: permissions.scan_rate_rtgs,
    scanRateCash: permissions.scan_rate_cash,
  };
}

export function mapApiPermissionsToEmployee(apiPermissions: Partial<ApiEmployeePermissions>): EmployeePermissions {
  const permissions: EmployeePermissions = { ...DEFAULT_EMPLOYEE_PERMISSIONS };

  const hasAnyMatrixKey = MATRIX_KEYS.some((key) => typeof apiPermissions[key] === 'boolean');
  if (hasAnyMatrixKey) {
    MATRIX_KEYS.forEach((key) => {
      const value = apiPermissions[key];
      permissions[key] = typeof value === 'boolean' ? value : DEFAULT_MATRIX_VALUES[key];
    });
  } else {
    // No per-tile keys on the record at all — it predates the matrix
    // feature, or the admin never opened that section. That is "nothing
    // decided", not "hide everything": setting every key false here blanked
    // the whole home screen for such employees, and no Dashboard Settings
    // change could bring it back because the screen reads these, not the
    // business-wide values. Show the business defaults instead.
    MATRIX_KEYS.forEach((key) => {
      permissions[key] = DEFAULT_MATRIX_VALUES[key];
    });
  }

  permissions.settings_formulae = Boolean(apiPermissions.manageFormulae);
  permissions.settings_inventory = Boolean(apiPermissions.inventoryManager);
  permissions.settings_purity = Boolean(apiPermissions.tunchPurity);
  permissions.settings_invoice = Boolean(apiPermissions.invoiceFormat);
  permissions.edit_rate_gold = apiPermissions.editRateGold ?? DEFAULT_EMPLOYEE_PERMISSIONS.edit_rate_gold;
  permissions.edit_rate_diamond = apiPermissions.editRateDiamond ?? DEFAULT_EMPLOYEE_PERMISSIONS.edit_rate_diamond;
  permissions.edit_rate_colorstone = apiPermissions.editRateColorstone ?? DEFAULT_EMPLOYEE_PERMISSIONS.edit_rate_colorstone;
  permissions.edit_rate_labour = apiPermissions.editRateLabour ?? DEFAULT_EMPLOYEE_PERMISSIONS.edit_rate_labour;
  permissions.scan_edit_purity_percent =
    apiPermissions.scanEditPurityPercent ?? DEFAULT_EMPLOYEE_PERMISSIONS.scan_edit_purity_percent;
  permissions.scan_rate_rtgs =
    apiPermissions.scanRateRtgs ?? DEFAULT_EMPLOYEE_PERMISSIONS.scan_rate_rtgs;
  permissions.scan_rate_cash =
    apiPermissions.scanRateCash ?? DEFAULT_EMPLOYEE_PERMISSIONS.scan_rate_cash;

  return permissions;
}

export function mapApiEmployeeToEmployee(raw: Record<string, unknown>): Employee {
  const permissionsRaw = raw.permissions;
  const apiPermissions =
    permissionsRaw && typeof permissionsRaw === 'object'
      ? (permissionsRaw as Partial<ApiEmployeePermissions>)
      : {};

  const id =
    readString(raw, ['id', '_id']) ??
    `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    fullName: readString(raw, ['name', 'fullName']) ?? 'Employee',
    designation: readString(raw, ['designation', 'role']) ?? 'Employee',
    phone: readString(raw, ['phone'])?.replace(/\D/g, '').slice(-10) ?? '',
    email: readString(raw, ['email']) ?? '',
    gender: 'Male',
    password: '',
    permissions: mapApiPermissionsToEmployee(apiPermissions),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
  };
}

function normalizeEmployeeList(raw: unknown): Employee[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(mapApiEmployeeToEmployee);
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const nested = record.employees ?? record.items ?? record.results;
    if (Array.isArray(nested)) {
      return normalizeEmployeeList(nested);
    }
  }

  return [];
}

/**
 * Whether a number can become a new employee's login. False for a super
 * admin's login or an employee of this shop, and for the owner's own number
 * (`reason` OWN_NUMBER). True, with `transfer`, for a login the server moves
 * once the number is proved: another shop's owner or employee, or another
 * admin of this shop.
 */
export async function checkEmployeePhone(
  phone: string,
): Promise<
  | { success: true; available: boolean; transfer: EmployeePhoneTransfer | null; reason: string | null }
  | EmployeeApiFailure
> {
  const fallback = 'Could not check this number. Please try again.';
  try {
    const query = encodeURIComponent(normalizeIndianPhone(phone));
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/employees/check-phone?phone=${query}`,
      { method: 'GET' },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    if (typeof unwrapped.available !== 'boolean') {
      // A server from before this check: no answer is not a yes.
      return { success: false, error: fallback };
    }
    return {
      success: true,
      available: unwrapped.available,
      transfer: unwrapped.available ? readPhoneTransfer(unwrapped.transfer) : null,
      reason: unwrapped.available ? null : (readErrorCode(unwrapped, 'reason') ?? null),
    };
  } catch (error) {
    const failure = toFailure(error, fallback);
    // The route is missing on a server that has not been updated yet; say
    // that rather than "not found", which reads as a fault in the number.
    if (failure.status === 404) {
      return { ...failure, error: 'The server is not updated for employee MPINs yet. Please try again later.' };
    }
    return failure;
  }
}

/**
 * Sends a 6-digit OTP by SMS to the number a new employee is added with (or
 * an employee's number is changed to). The server refuses the owner's own
 * number with OWN_NUMBER, and a super admin's login or an employee of this
 * shop with PHONE_ALREADY_REGISTERED. `transfer` says whose login the number
 * is when the add will move it.
 */
export async function sendEmployeePhoneOtp(
  phone: string,
  /** The employee whose number is changing; absent when adding someone. */
  employeeId?: string | null,
): Promise<
  | { success: true; resendAfterSeconds: number; transfer: EmployeePhoneTransfer | null }
  | EmployeeApiFailure
> {
  const fallback = 'Could not send the OTP. Please try again.';
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/employees/phone-otp', {
      method: 'POST',
      body: { phone: normalizeIndianPhone(phone), ...(employeeId ? { employeeId } : {}) },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    const wait = Number(unwrapped.resendAfterSeconds);
    return {
      success: true,
      resendAfterSeconds: Number.isFinite(wait) && wait > 0 ? wait : 30,
      transfer: readPhoneTransfer(unwrapped.transfer),
    };
  } catch (error) {
    const failure = toFailure(error, fallback);
    if (failure.status === 404) {
      return { ...failure, error: 'The server is not updated for employee OTP yet. Please try again later.' };
    }
    return failure;
  }
}

/**
 * Checks the OTP the employee received. The answer is the token the add (or
 * the number change) carries: the server accepts the number only with it,
 * for 30 minutes.
 */
export async function verifyEmployeePhoneOtp(
  phone: string,
  otp: string,
): Promise<{ success: true; token: string } | EmployeeApiFailure> {
  const fallback = 'Could not check the OTP. Please try again.';
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/employees/phone-otp/verify', {
      method: 'POST',
      body: { phone: normalizeIndianPhone(phone), otp: otp.trim() },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    const token = readString(unwrapped, ['phoneVerificationToken']);
    if (!token) return { success: false, error: fallback };
    return { success: true, token };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

/**
 * Creates the employee in one call — details, the login MPIN the owner set
 * and the permissions chosen — which the server also saves as the
 * employee's own user, so they sign in like an owner does.
 *
 * A number that is another shop's owner or employee, or another admin of
 * this shop, has that login moved here by this call. Nothing is written when
 * the number cannot be taken: that comes back as `code` OWN_NUMBER or
 * PHONE_ALREADY_REGISTERED.
 *
 * `confirmTransfer` says the owner was shown whose login the number moves
 * (Verify Phone's line). Builds before this one never send it, so a server
 * that asks for it moves no one for an app that never said so; a server
 * that does not ask drops it.
 */
export async function createEmployeeWithMpin(payload: {
  name: string;
  phone: string;
  email?: string;
  designation: string;
  mpin: string;
  confirmMpin: string;
  permissions: EmployeePermissions;
  /** From verifyEmployeePhoneOtp, for this phone. */
  phoneVerificationToken?: string;
  /** The owner was shown that this number's login moves here. */
  confirmTransfer?: boolean;
}): Promise<{ success: true; employee: Employee } | EmployeeApiFailure> {
  const fallback = 'Failed to create employee.';
  try {
    const email = payload.email?.trim().toLowerCase();
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/employees', {
      method: 'POST',
      body: {
        name: payload.name.trim(),
        phone: normalizeIndianPhone(payload.phone),
        ...(email ? { email } : {}),
        designation: payload.designation.trim(),
        mpin: payload.mpin,
        confirmMpin: payload.confirmMpin,
        permissions: mapDraftPermissionsToApi(payload.permissions),
        ...(payload.phoneVerificationToken ? { phoneVerificationToken: payload.phoneVerificationToken } : {}),
        ...(payload.confirmTransfer ? { confirmTransfer: true } : {}),
      },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    const raw = unwrapped.employee;
    if (!raw || typeof raw !== 'object') {
      // A server from before MPIN logins answers this body by parking a
      // draft and creating no one — never report that as done.
      return {
        success: false,
        error: 'The server is not updated for employee MPINs yet, so the employee was not created.',
      };
    }
    return { success: true, employee: mapApiEmployeeToEmployee(raw as Record<string, unknown>) };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

/**
 * The employee's current MPIN, read back from the server's sealed copy (as
 * Forgot MPIN does for an owner). `mpin` is null when there is no readable
 * copy — an employee from before MPINs, or one whose MPIN predates the copy.
 */
export async function getEmployeeMpin(
  id: string,
): Promise<{ success: true; mpin: string | null } | EmployeeApiFailure> {
  const fallback = 'Could not read the MPIN.';
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/employees/${encodeURIComponent(id)}/mpin`,
      { method: 'GET' },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    const value = readString(unwrapped, ['mpin']);
    return { success: true, mpin: value && /^\d{4}$/.test(value) ? value : null };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

export async function updateEmployeeMpin(
  id: string,
  mpin: string,
  confirmMpin: string,
): Promise<{ success: true } | EmployeeApiFailure> {
  const fallback = 'Could not update the MPIN.';
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/employees/${encodeURIComponent(id)}/mpin`,
      { method: 'PUT', body: { mpin, confirmMpin } },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    return { success: true };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

export async function updateEmployeeApi(
  id: string,
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    designation?: string;
    permissions?: EmployeePermissions;
    isActive?: boolean;
    /** Needed only when `phone` is a new number: the token for that number. */
    phoneVerificationToken?: string;
    /** The owner was shown that the new number's login moves here (as createEmployeeWithMpin). */
    confirmTransfer?: boolean;
  }
): Promise<{ success: boolean; error?: string; code?: string }> {
  const fallback = 'Failed to update employee.';
  try {
    const body: Record<string, any> = {};
    if (payload.name) body.name = payload.name.trim();
    if (payload.phone) body.phone = normalizeIndianPhone(payload.phone);
    if (payload.email) body.email = payload.email.trim().toLowerCase();
    if (typeof payload.designation === 'string') body.designation = payload.designation.trim();
    if (payload.permissions) body.permissions = mapDraftPermissionsToApi(payload.permissions);
    if (typeof payload.isActive === 'boolean') body.isActive = payload.isActive;
    if (payload.phoneVerificationToken) body.phoneVerificationToken = payload.phoneVerificationToken;
    if (payload.confirmTransfer) body.confirmTransfer = true;

    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(`/employees/${id}`, {
      method: 'PUT',
      body,
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return envelopeFailure(response, unwrapped, fallback);
    }
    return { success: true };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

export async function fetchEmployees(): Promise<{
  success: boolean;
  data?: Employee[];
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/employees', {
      method: 'GET',
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to load employees.'),
      };
    }

    const employees = normalizeEmployeeList(unwrapped.data ?? unwrapped);
    return { success: true, data: employees };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to load employees.',
    };
  }
}

export async function deleteEmployeeApi(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(`/employees/${id}`, {
      method: 'DELETE',
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to delete employee.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to delete employee.',
    };
  }
}
