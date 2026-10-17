/**
 * The plain logic behind Delete Account: when the delete button may be
 * pressed, what the screen says to an owner and to an employee, and the
 * server's refusals in words.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/accountDeletion.test.mjs, so what is tested is what the
 * app runs.
 */

/** Typed exactly, capitals and all, to say the person means it. */
export const DELETE_CONFIRM_WORD = 'DELETE';

export const ACCOUNT_DELETE_OTP_LENGTH = 6;

/** Another code may be asked for this long after the last one was texted. */
export const ACCOUNT_DELETE_RESEND_SECONDS = 30;

/**
 * The delete button works only with the whole code. The owner dropped the
 * typed DELETE; the app still sends the word the server asks for.
 */
export function canConfirmAccountDeletion(otp: string): boolean {
  return new RegExp(`^\\d{${ACCOUNT_DELETE_OTP_LENGTH}}$`).test(otp);
}

/**
 * What deleting does, in the person's terms. Only the login goes: an owner's
 * shop records stay on the server, and an employee has no shop records of
 * their own to mention.
 */
export function accountDeletionNote(isEmployee: boolean): string {
  return isEmployee
    ? 'Your login will be removed and you will be signed out.'
    : "Your login will be removed and you will be signed out. Your shop's records stay saved.";
}

/** The line under Send OTP once the code has gone, with the number as the server masked it. */
export function otpSentLine(phoneMasked: string | null | undefined): string {
  const masked = (phoneMasked ?? '').trim();
  return masked ? `OTP sent to ${masked}` : 'OTP sent to your registered phone number';
}

/** When the request got no answer at all: no signal, or a timeout. */
export const ACCOUNT_DELETE_NO_ANSWER = "Couldn't reach the server. Check your internet connection and try again.";

// RATE_LIMIT_EXCEEDED is not here on purpose: the server's own sentence says
// how long to wait ("Please try again in an hour."), which no app text knows.
const FAILURE_MESSAGES: Record<string, string> = {
  CONFIRMATION_REQUIRED: `Type ${DELETE_CONFIRM_WORD} in capital letters to confirm.`,
  OTP_INVALID: 'That OTP is not correct. Check the SMS and try again.',
  OTP_EXPIRED: 'This OTP has expired. Send a new one.',
  OTP_NOT_FOUND: 'Send an OTP first, then enter it here.',
  OTP_ALREADY_USED: 'This OTP was already used. Send a new one.',
  OTP_SEND_FAILED: "Couldn't send the OTP right now. Please try again.",
  OTP_LIMIT_EXCEEDED: 'Too many attempts just now. Please try again a little later.',
  RESEND_TIMEOUT: 'Please wait a moment before asking for another OTP.',
  USER_NOT_FOUND: 'This login could not be found. It may already be deleted.',
  UNAUTHORIZED: 'Please sign in again.',
};

/**
 * What the screen shows for a refused request.
 *
 * The code decides first, whatever the status: these routes answer
 * OTP_NOT_FOUND with a 400, but the server's general error handler sends it
 * as a 404, which on its own would read as "the server does not have this
 * yet". A 404 with no code is exactly that — a server older than the app.
 * A 5xx with no code known here is the fallback: its text is whatever broke
 * inside the server ("disk full", a database error), not words for a person.
 * Otherwise the server's own sentence, and the fallback when all it sent was
 * a code nobody here knows.
 */
export function accountDeletionFailureMessage(
  failure: { code?: string; status?: number; message?: string },
  fallback: string,
): string {
  if (failure.code && FAILURE_MESSAGES[failure.code]) return FAILURE_MESSAGES[failure.code];
  if (failure.status === 404) {
    return 'Deleting an account is not available on the server yet. Please try again after the next update.';
  }
  if (failure.status !== undefined && failure.status >= 500) return fallback;
  const message = (failure.message ?? '').trim();
  if (!message || /^[A-Z][A-Z0-9_]{3,}$/.test(message)) return fallback;
  return message;
}
