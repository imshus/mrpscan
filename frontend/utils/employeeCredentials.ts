/**
 * The pieces of an employee's login that are plain logic: the phone number as
 * the server keys it, the 4-digit MPIN the owner sets for them, and the
 * message the owner shares with them once it is set.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/employeeCredentials.test.mjs, so what is tested is what the
 * app runs.
 */

export const EMPLOYEE_MPIN_LENGTH = 4;

/** What the Add and Permissions screens say when the number is anyone's login. */
export const PHONE_TAKEN_MESSAGE = 'This number is already registered';

export const MPIN_REQUIRED_MESSAGE = 'Enter a 4-digit MPIN';
export const MPIN_MISMATCH_MESSAGE = "MPINs don't match";

/**
 * The digits of a number however it was typed or pasted: spaces, dashes and
 * a leading +91 or 0 fall away. The server normalises the same way, so the
 * number checked is the number saved. Anything that is still not ten digits
 * is returned as it stands, for the validation to refuse — never trimmed
 * into some other person's number.
 */
export function normalizeIndianPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isTenDigitPhone(raw: string | null | undefined): boolean {
  return /^\d{10}$/.test(normalizeIndianPhone(raw));
}

/** "+91 9876512340", as the credentials card prints it; a dash when there is no number. */
export function formatPhoneForDisplay(raw: string | null | undefined): string {
  const phone = normalizeIndianPhone(raw);
  return phone.length === 10 ? `+91 ${phone}` : '—';
}

export interface MpinPairErrors {
  mpin: string | null;
  confirm: string | null;
}

/**
 * Create + Confirm, checked the way the mockup checks them: the first field
 * must hold four digits, and only then must the second match it. One error
 * at a time, under the field it belongs to.
 */
export function validateMpinPair(mpin: string, confirm: string): MpinPairErrors {
  if (!/^\d{4}$/.test(mpin)) return { mpin: MPIN_REQUIRED_MESSAGE, confirm: null };
  if (confirm !== mpin) return { mpin: null, confirm: MPIN_MISMATCH_MESSAGE };
  return { mpin: null, confirm: null };
}

export function isMpinPairValid(mpin: string, confirm: string): boolean {
  const errors = validateMpinPair(mpin, confirm);
  return !errors.mpin && !errors.confirm;
}

/** The text the owner sends the employee, word for word as the mockup has it. */
export function buildEmployeeLoginShareMessage(phone: string, mpin: string): string {
  return (
    `Your MRPscan login — Phone: ${formatPhoneForDisplay(phone)}, MPIN: ${mpin}. ` +
    'Sign in with your phone number, OTP and this MPIN.'
  );
}

/** WhatsApp's own scheme first; the web link opens WhatsApp (or its site) when the app is not installed. */
export function whatsappShareUrls(message: string): { app: string; web: string } {
  const text = encodeURIComponent(message);
  return {
    app: `whatsapp://send?text=${text}`,
    web: `https://wa.me/?text=${text}`,
  };
}

/** The SMS composer with the message filled in. iOS reads `&body=`, Android `?body=`. */
export function smsShareUrl(message: string, platformOS: string): string {
  const body = encodeURIComponent(message);
  return platformOS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`;
}
