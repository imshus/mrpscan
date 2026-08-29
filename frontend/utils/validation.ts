import { z } from 'zod';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PASSWORD_MIN_LENGTH = 8;
const OTP_REGEX = /^\d{6}$/;

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .regex(EMAIL_REGEX, 'Enter a valid email address');

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .pipe(
    z
      .string()
      .min(1, 'Phone number is required')
      .regex(PHONE_REGEX, 'Enter a valid 10-digit phone number'),
  );

const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

const confirmPasswordSchema = z
  .string()
  .min(1, 'Please confirm your password');

const otpSchema = z
  .string()
  .min(1, 'OTP is required')
  .regex(OTP_REGEX, 'Enter the 6-digit OTP');

export function normalizeGstNumber(gst: string): string {
  return gst.trim().toUpperCase().replace(/^GSTN/i, '');
}

const gstSchema = z
  .string()
  .trim()
  .transform((value) => normalizeGstNumber(value))
  .superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GST number is required',
      });
      return;
    }

    if (GST_REGEX.test(value)) return;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid 15-character GST number',
    });
  });

function getValidationError(result: {
  success: boolean;
  error?: { issues: readonly { message: string }[] };
}): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? 'Invalid value';
}

export function validateGst(gst: string): string | null {
  return getValidationError(gstSchema.safeParse(gst));
}

export function validateEmail(email: string): string | null {
  return getValidationError(emailSchema.safeParse(email));
}

export function validatePhone(phone: string): string | null {
  return getValidationError(phoneSchema.safeParse(phone));
}

export function validatePassword(password: string): string | null {
  return getValidationError(passwordSchema.safeParse(password));
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  const confirmError = getValidationError(confirmPasswordSchema.safeParse(confirm));
  if (confirmError) return confirmError;
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

export function validateOtp(otp: string): string | null {
  return getValidationError(otpSchema.safeParse(otp));
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 4) return phone;
  return `+91 ${digits.slice(0, 2)} ******${digits.slice(-2)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 4).toLowerCase();
  return `${visible}***@${domain}`;
}
