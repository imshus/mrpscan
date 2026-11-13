/**
 * What Log In does with a refused MPIN sign-in, decided from the server's
 * error code alone (never its wording).
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/employeeCredentials.test.mjs.
 */

/** Shown to an employee whose owner has not set them an MPIN yet. */
export const EMPLOYEE_MPIN_NOT_SET_MESSAGE = 'Ask your shop owner to set your MPIN';

export type LoginFailureKind =
  /** An owner account from before MPINs: send it to set one over an OTP. */
  | 'owner-mpin-not-set'
  /** An employee with no MPIN: only their owner can set it — say so, go nowhere. */
  | 'employee-mpin-not-set'
  /** The four digits were wrong (or the server gave no code): "Incorrect MPIN." */
  | 'wrong-credentials'
  /** Any other refusal the server named (a revoked employee, say): show its own message. */
  | 'refused';

const CREDENTIAL_CODES = new Set([
  'INVALID_PHONE_CREDENTIALS',
  'INVALID_MPIN',
  'INVALID_CREDENTIALS',
  'INVALID_EMPLOYEE_CREDENTIALS',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
]);

export function classifyLoginFailure(code: string | null | undefined): LoginFailureKind {
  if (code === 'MPIN_NOT_SET') return 'owner-mpin-not-set';
  if (code === 'EMPLOYEE_MPIN_NOT_SET') return 'employee-mpin-not-set';
  if (!code || CREDENTIAL_CODES.has(code)) return 'wrong-credentials';
  return 'refused';
}
