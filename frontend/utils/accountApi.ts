import { apiRequest, ApiError } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';
import {
  ACCOUNT_DELETE_NO_ANSWER,
  ACCOUNT_DELETE_RESEND_SECONDS,
  DELETE_CONFIRM_WORD,
  accountDeletionFailureMessage,
} from '@/utils/accountDeletion';

type ApiEnvelope = Record<string, unknown> & {
  success?: boolean;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
};

export interface AccountApiFailure {
  success: false;
  /** The server's own code (`error` in its body), e.g. OTP_INVALID. */
  code?: string;
  /** HTTP status; absent when the request never got an answer. */
  status?: number;
  /** In words, ready for the screen. */
  error: string;
}

/** A server code is an UPPER_SNAKE word; anything else in `error` is prose. */
function readErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>).error;
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value) ? value : undefined;
}

function readMessage(body: Record<string, unknown>): string | undefined {
  for (const key of ['message', 'error']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function toFailure(error: unknown, fallback: string): AccountApiFailure {
  if (error instanceof ApiError) {
    // No answer at all (no signal, a timeout): apiClient's text for that is
    // written for developers — the server's address, EXPO_PUBLIC_API_URL.
    if (error.status === undefined) return { success: false, error: ACCOUNT_DELETE_NO_ANSWER };
    const code = readErrorCode(error.body);
    return {
      success: false,
      code,
      status: error.status,
      error: accountDeletionFailureMessage({ code, status: error.status, message: error.message }, fallback),
    };
  }
  return { success: false, error: fallback };
}

/** A 200 that still says no: `success: false` in the envelope. */
function envelopeFailure(response: ApiEnvelope, fallback: string): AccountApiFailure | null {
  const data = unwrapApiData(response) as Record<string, unknown>;
  const success = typeof data.success === 'boolean' ? data.success : response.success;
  if (success !== false) return null;
  const code = readErrorCode(data) ?? readErrorCode(response);
  return {
    success: false,
    code,
    error: accountDeletionFailureMessage(
      { code, message: readMessage(data) ?? readMessage(response) },
      fallback,
    ),
  };
}

/**
 * Texts a 6-digit code to the signed-in person's own phone — the owner's
 * login number, or the employee's — which DELETE /auth/account then asks for.
 * The server picks the number; the app only shows it, masked as sent.
 */
export async function sendAccountDeleteOtp(): Promise<
  { success: true; phoneMasked: string | null; resendAfterSeconds: number } | AccountApiFailure
> {
  const fallback = 'Could not send the OTP. Please try again.';
  try {
    const response = await apiRequest<ApiEnvelope>('/auth/account/delete-otp', {
      method: 'POST',
      body: {},
    });
    const refused = envelopeFailure(response, fallback);
    if (refused) return refused;
    const data = unwrapApiData(response) as Record<string, unknown>;
    const wait = Number(data.resendAfterSeconds);
    return {
      success: true,
      phoneMasked: typeof data.phoneMasked === 'string' && data.phoneMasked.trim() ? data.phoneMasked.trim() : null,
      resendAfterSeconds: Number.isFinite(wait) && wait > 0 ? wait : ACCOUNT_DELETE_RESEND_SECONDS,
    };
  } catch (error) {
    return toFailure(error, fallback);
  }
}

/**
 * Deletes the signed-in person's own login, with the code from
 * sendAccountDeleteOtp; the confirmation word the server asks for is sent
 * as it stands (the screen no longer has it typed). Only the login goes: the
 * shop's records stay on the server.
 */
export async function deleteAccount(otp: string): Promise<{ success: true } | AccountApiFailure> {
  const fallback = 'Could not delete the account. Please try again.';
  try {
    const response = await apiRequest<ApiEnvelope>('/auth/account', {
      method: 'DELETE',
      body: { otp: otp.trim(), confirm: DELETE_CONFIRM_WORD },
    });
    return envelopeFailure(response, fallback) ?? { success: true };
  } catch (error) {
    return toFailure(error, fallback);
  }
}
