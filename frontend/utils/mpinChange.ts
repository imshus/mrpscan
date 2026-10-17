/**
 * Settings → MPIN Manager, as plain logic: the checks the screen makes before
 * it sends anything, how a refusal from POST /auth/change-mpin is read, and
 * which of its three fields it belongs under. The sentences are the design's
 * and the server's, word for word.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/mpinChange.test.mjs, so what is tested is what the app runs.
 */

export const MPIN_CHANGE_LENGTH = 4;

export const MPIN_INCORRECT_MESSAGE = 'Incorrect MPIN.';
export const MPIN_INVALID_MESSAGE = 'Enter a 4-digit MPIN';
export const MPIN_CHANGE_MISMATCH_MESSAGE = "MPINs don't match";
export const MPIN_SAME_MESSAGE = 'Choose an MPIN different from the current one';
/**
 * "Forgot MPIN?" for an employee: the server refuses MPIN recovery for an
 * employee's login at every step, and their owner can read or reset it.
 */
export const MPIN_EMPLOYEE_FORGOT_MESSAGE = 'Ask your shop owner. They can see or reset your MPIN in Employee Manager.';
/** When the server's 429 came back without a sentence of its own. */
export const MPIN_TOO_MANY_ATTEMPTS_MESSAGE = 'Too many wrong attempts. Please try again in 15 minutes.';

export type MpinChangeField = 'current' | 'next' | 'confirm';

export interface MpinChangeErrors {
  current: string | null;
  next: string | null;
  confirm: string | null;
}

export const NO_MPIN_CHANGE_ERRORS: MpinChangeErrors = { current: null, next: null, confirm: null };

const isFourDigits = (value: string) => new RegExp(`^\\d{${MPIN_CHANGE_LENGTH}}$`).test(value);

/**
 * One field at a time, top to bottom, as the mockup's Update MPIN does: the
 * first thing wrong is the only thing said. Whether the current MPIN is the
 * right one only the server can tell; one that is not four digits cannot be,
 * so it reads "Incorrect MPIN." too — the only line the design has under it.
 */
export function validateMpinChange(current: string, next: string, confirm: string): MpinChangeErrors {
  if (!isFourDigits(current)) return { ...NO_MPIN_CHANGE_ERRORS, current: MPIN_INCORRECT_MESSAGE };
  if (!isFourDigits(next)) return { ...NO_MPIN_CHANGE_ERRORS, next: MPIN_INVALID_MESSAGE };
  if (confirm !== next) return { ...NO_MPIN_CHANGE_ERRORS, confirm: MPIN_CHANGE_MISMATCH_MESSAGE };
  if (next === current) return { ...NO_MPIN_CHANGE_ERRORS, next: MPIN_SAME_MESSAGE };
  return NO_MPIN_CHANGE_ERRORS;
}

export function hasMpinChangeError(errors: MpinChangeErrors): boolean {
  return Boolean(errors.current || errors.next || errors.confirm);
}

/**
 * The field a server refusal is shown under, or null for one that belongs
 * to none of them (too many attempts, offline, anything else) and is shown
 * under the button instead.
 */
export function mpinChangeErrorField(code: string | null | undefined): MpinChangeField | null {
  switch (code) {
    case 'MPIN_INCORRECT':
      return 'current';
    case 'MPIN_INVALID':
    case 'MPIN_SAME':
      return 'next';
    case 'MPIN_MISMATCH':
      return 'confirm';
    default:
      return null;
  }
}

/**
 * The code and the sentence of a JSON refusal ({ error, message }), each
 * null when it is missing or not what it should be: a code is UPPER_CASE,
 * and a message that is itself a bare code says nothing to a shop.
 */
export function readServerRefusal(body: unknown): { code: string | null; message: string | null } {
  if (!body || typeof body !== 'object') return { code: null, message: null };
  const { error, message } = body as Record<string, unknown>;
  const code = typeof error === 'string' ? error.trim() : '';
  const text = typeof message === 'string' ? message.trim() : '';
  return {
    code: /^[A-Z][A-Z0-9_]+$/.test(code) ? code : null,
    message: text && !/^[A-Z][A-Z0-9_]{3,}$/.test(text) ? text : null,
  };
}

/** The design's sentence for a refusal code, so the field reads the same whatever the server wrote. */
export function mpinChangeMessage(code: string | null | undefined, serverMessage: string): string {
  switch (code) {
    case 'MPIN_INCORRECT':
      return MPIN_INCORRECT_MESSAGE;
    case 'MPIN_INVALID':
      return MPIN_INVALID_MESSAGE;
    case 'MPIN_MISMATCH':
      return MPIN_CHANGE_MISMATCH_MESSAGE;
    case 'MPIN_SAME':
      return MPIN_SAME_MESSAGE;
    default:
      return serverMessage;
  }
}
