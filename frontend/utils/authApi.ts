import { apiRequest, ApiError } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';
import type { BusinessLoginResponse } from '@/types/auth';
import { normalizeGstNumber } from '@/utils/validation';

type ApiEnvelope<T extends Record<string, unknown>> = T & {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
};

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

export type RegistrationErrorField = 'phone' | 'userId' | 'password';

function classifyRegistrationError(value: unknown): RegistrationErrorField | undefined {
  let text = '';
  if (value instanceof ApiError) {
    const body = value.body;
    if (body && typeof body === 'object') {
      const rawCode = (body as { error?: unknown }).error;
      const rawMessage = (body as { message?: unknown }).message;
      text = `${typeof rawCode === 'string' ? rawCode : ''} ${typeof rawMessage === 'string' ? rawMessage : ''}`;
    }
    text += ` ${value.message}`;
  } else {
    text = String(value ?? '');
  }

  const normalized = text.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('userid')) return 'userId';
  if (normalized.includes('password')) return 'password';
  if (
    normalized.includes('phone') ||
    normalized.includes('mobile') ||
    normalized.includes('alreadyassociated')
  ) {
    return 'phone';
  }
  return undefined;
}

export async function verifyBusinessGst(gstNumber: string): Promise<{
  success: boolean;
  businessName?: string;
  address?: string;
  businessType?: string;
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/business/gst/verify',
      {
        method: 'POST',
        body: { gstNumber: normalizeGstNumber(gstNumber) },
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'GST verification failed.'),
      };
    }
    const businessName = readString(unwrapped, ['businessName', 'legalName', 'tradeName', 'name']);
    const address = readString(unwrapped, ['address', 'registeredAddress', 'principalAddress']);
    const businessType = readString(unwrapped, ['businessType', 'companyType', 'type']);
    return { success: true, businessName, address, businessType };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'GST verification failed.',
    };
  }
}

export async function verifyAndConfirmBusinessGst(gstNumber: string): Promise<{
  success: boolean;
  businessId?: string;
  businessName?: string;
  address?: string;
  businessType?: string;
  error?: string;
}> {
  const verifyResult = await verifyBusinessGst(gstNumber);
  if (!verifyResult.success) {
    return verifyResult;
  }

  try {
    const confirmed = await confirmBusinessGst(gstNumber);
    return {
      success: true,
      businessId: confirmed.businessId,
      businessName: verifyResult.businessName,
      address: verifyResult.address,
      businessType: verifyResult.businessType,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm GST details.',
    };
  }
}

export async function confirmBusinessGst(gstNumber: string): Promise<{ businessId: string }> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
    '/auth/business/gst/confirm',
    {
      method: 'POST',
      body: { gstNumber: normalizeGstNumber(gstNumber) },
    },
  );

  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to confirm GST details.'));
  }
  const businessId = readString(unwrapped, ['businessId', 'id']);
  if (!businessId) {
    throw new Error('businessId missing in GST confirm response.');
  }
  return { businessId };
}

export async function submitBusinessContactDetails(payload: {
  businessId: string;
  phone: string;
}): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/business/contact-details', {
    method: 'POST',
    body: {
      businessId: payload.businessId,
      phone: payload.phone.replace(/\D/g, ''),
    },
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to submit contact details.'));
  }
}

export async function fetchDevOtps(businessId: string): Promise<{ phone?: string }> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `/auth/dev/otps/${encodeURIComponent(businessId)}`,
    { method: 'GET' },
  );
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    return {};
  }
  const phone = readString(unwrapped, ['phone']);
  return { phone };
}

export async function verifyBusinessPhoneOtp(
  businessId: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/business/verify-phone-otp', {
      method: 'POST',
      body: { businessId, otp: otp.trim() },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Phone OTP verification failed.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Phone OTP verification failed.',
    };
  }
}

export async function sendLoginOtp(mobile: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/send-otp', {
      method: 'POST',
      body: { mobile: mobile.replace(/\D/g, '').slice(-10) },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to send OTP.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to send OTP.',
    };
  }
}

export async function verifyLoginOtp(
  mobile: string,
  otp: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/verify-otp', {
      method: 'POST',
      body: {
        mobile: mobile.replace(/\D/g, '').slice(-10),
        otp: otp.trim(),
      },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'OTP verification failed.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'OTP verification failed.',
    };
  }
}

export async function requestPasswordReset(identifier: string): Promise<{
  success: boolean;
  destination?: string;
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/forgot-password/request',
      {
        method: 'POST',
        body: { identifier: identifier.trim() },
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to send password reset code.'),
      };
    }
    return {
      success: true,
      destination: readString(unwrapped, ['destination']),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to send password reset code.',
    };
  }
}

export async function verifyPasswordResetOtp(
  identifier: string,
  otp: string,
): Promise<{ success: boolean; resetToken?: string; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/forgot-password/verify-otp',
      {
        method: 'POST',
        body: { identifier: identifier.trim(), otp: otp.trim() },
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'OTP verification failed.'),
      };
    }
    const resetToken = readString(unwrapped, ['resetToken']);
    if (!resetToken) {
      return { success: false, error: 'Password reset response is missing its secure token.' };
    }
    return { success: true, resetToken };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'OTP verification failed.',
    };
  }
}

export async function resetForgottenPassword(
  resetToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/forgot-password/reset',
      {
        method: 'POST',
        body: { resetToken, newPassword, confirmPassword },
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to reset password.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to reset password.',
    };
  }
}

export async function createBusinessPassword(payload: {
  businessId: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/business/create-password', {
      method: 'POST',
      body: payload,
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to create business password.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to create business password.',
    };
  }
}

/** Signup-form pre-check. A failed request is never treated as "available". */
export async function checkRegistrationAvailability(payload: {
  mobile: string;
  userId: string;
}): Promise<{
  success: boolean;
  phoneTaken: boolean;
  userIdTaken: boolean;
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/check-availability',
      {
        method: 'POST',
        body: {
          mobile: payload.mobile.replace(/\D/g, '').slice(-10),
          userId: payload.userId.trim(),
        },
        timeoutMs: 10000,
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        phoneTaken: false,
        userIdTaken: false,
        error: resolveApiMessage(response, unwrapped, 'Could not check availability.'),
      };
    }
    return {
      success: true,
      phoneTaken: unwrapped?.phoneTaken === true,
      userIdTaken: unwrapped?.userIdTaken === true,
    };
  } catch (error) {
    return {
      success: false,
      phoneTaken: false,
      userIdTaken: false,
      error: error instanceof ApiError ? error.message : 'Could not check availability.',
    };
  }
}

export async function registerBusiness(payload: {
  mobile: string;
  password: string;
  userId?: string;
  businessDetails: {
    businessId: string;
    businessName?: string;
    businessType?: string;
    address?: string;
  };
}): Promise<{ success: boolean; error?: string; field?: RegistrationErrorField }> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/register', {
      method: 'POST',
      body: {
        mobile: payload.mobile.replace(/\D/g, '').slice(-10),
        password: payload.password,
        userId: payload.userId?.trim() || undefined,
        businessDetails: payload.businessDetails,
      },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Registration failed.'),
        field: classifyRegistrationError(resolveApiMessage(response, unwrapped, '')),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Registration failed.',
      field: classifyRegistrationError(error),
    };
  }
}

export async function loginBusiness(mobile: string, password: string): Promise<{
  success: boolean;
  data?: BusinessLoginResponse & {
    businessName?: string;
    gstNumber?: string;
    businessType?: string;
    address?: string;
    phone?: string;
    role?: string;
    /** The handle the user signs in with — distinct from the account's id. */
    loginId?: string;
  };
  error?: string;
}> {
  try {
    // Sign-in is by User ID only, so send exactly what was typed. Stripping
    // formatting would corrupt IDs containing dots, underscores or hyphens.
    const loginId = mobile.trim();
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/login', {
      method: 'POST',
      body: { mobile: loginId, password },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Login failed.'),
      };
    }
    const accessToken = readString(unwrapped, ['accessToken', 'token']);
    const refreshToken = readString(unwrapped, ['refreshToken']);
    const businessName = readString(unwrapped, ['businessName']);
    const gstNumber = readString(unwrapped, ['gstNumber']);
    const businessType = readString(unwrapped, ['businessType']);
    const address = readString(unwrapped, ['address']);
    const phone = readString(unwrapped, ['phone']);
    const role = readString(unwrapped, ['role']);
    const resolvedLoginId = readString(unwrapped, ['loginId']);

    if (!accessToken) {
      return { success: false, error: 'Login response missing access token.' };
    }

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        businessName,
        gstNumber,
        businessType,
        address,
        phone,
        role,
        loginId: resolvedLoginId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Login failed.',
    };
  }
}

export async function loginBusinessWithOtp(mobile: string, otp: string): Promise<{
  success: boolean;
  data?: BusinessLoginResponse & {
    businessName?: string;
    gstNumber?: string;
    businessType?: string;
    address?: string;
    phone?: string;
    role?: string;
    /** The handle the user signs in with — distinct from the account's id. */
    loginId?: string;
  };
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/login-otp', {
      method: 'POST',
      body: {
        mobile: mobile.replace(/\D/g, '').slice(-10),
        otp: otp.trim(),
      },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'OTP login failed.'),
      };
    }

    const accessToken = readString(unwrapped, ['accessToken', 'token']);
    const refreshToken = readString(unwrapped, ['refreshToken']);
    const businessName = readString(unwrapped, ['businessName']);
    const gstNumber = readString(unwrapped, ['gstNumber']);
    const businessType = readString(unwrapped, ['businessType']);
    const address = readString(unwrapped, ['address']);
    const phone = readString(unwrapped, ['phone']);
    const role = readString(unwrapped, ['role']);
    const loginId = readString(unwrapped, ['loginId']);

    if (!accessToken) {
      return { success: false, error: 'Login response missing access token.' };
    }

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        businessName,
        gstNumber,
        businessType,
        address,
        phone,
        role,
        loginId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'OTP login failed.',
    };
  }
}

export async function loginEmployeeByPhone(phone: string, password: string): Promise<{
  success: boolean;
  data?: BusinessLoginResponse & { role?: string };
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/employee/login', {
      method: 'POST',
      body: { phone: phone.replace(/\D/g, '').slice(-10), password },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Login failed.'),
      };
    }
    const accessToken = readString(unwrapped, ['accessToken', 'token']);
    const refreshToken = readString(unwrapped, ['refreshToken']);
    const role = readString(unwrapped, ['role']);

    if (!accessToken) {
      return { success: false, error: 'Login response missing access token.' };
    }

    return { success: true, data: { accessToken, refreshToken, role } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Login failed.',
    };
  }
}

export async function fetchEmployeePermissions(): Promise<{
  success: boolean;
  data?: { permissions: Record<string, boolean> };
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      '/auth/employee/permissions',
      {
        method: 'GET',
      },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to load permissions.'),
      };
    }
    const permissions = (unwrapped.permissions ?? (unwrapped.data as any)?.permissions) as
      | Record<string, boolean>
      | undefined;
    if (!permissions) {
      return { success: false, error: 'Permissions missing in response.' };
    }
    return { success: true, data: { permissions } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to load permissions.',
    };
  }
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      return {
        success: false,
        error: resolveApiMessage(response, unwrapped, 'Failed to change password.'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiError ? error.message : 'Failed to change password.',
    };
  }
}
