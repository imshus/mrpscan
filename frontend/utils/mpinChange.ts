/**
 * Settings → MPIN Manager, as plain logic: the checks the screen makes before
 * it sends anything, and which of its three fields a refusal from
 * POST /auth/change-mpin belongs under. The sentences are the design's and
 * the server's, word for word.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/mpinChange.test.mjs, so what is tested is what the app runs.
 */

export const MPIN_CHANGE_LENGTH = 4;

export const MPIN_INCORRECT_MESSAGE = 'Incorrect MPIN.';
export const MPIN_INVALID_MESSAGE = 'Enter a 4-digit MPIN';
export const MPIN_CHANGE_MISMATCH_MESSAGE = "MPINs don't match";
export const MPIN_SAME_MESSAGE = 'Choose an MPIN different from the current one';
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
 * right one only the server can tell.
 */
export function validateMpinChange(current: string, next: string, confirm: string): MpinChangeErrors {
  if (!isFourDigits(current)) return { ...NO_MPIN_CHANGE_ERRORS, current: MPIN_INVALID_MESSAGE };
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
