import { apiRequest } from '@/utils/apiClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

/**
 * Changing the phone number or the GSTIN on the Profile screen.
 *
 * Four requests, in this order: the MPIN buys a short-lived edit token, the
 * new GSTIN is looked up at the registry so the shop sees whose name it is
 * about to take, an OTP goes to the new number, and the last call applies
 * both together. Every one of these throws on refusal — the screens turn the
 * code into a sentence with friendlyServerMessage.
 */

export interface GstPreview {
  gstNumber: string;
  businessName: string;
  address: string;
  gstStatus: string;
  isMock: boolean;
}

export interface ProfileUpdateResult {
  phoneChanged: boolean;
  gstChanged: boolean;
  phone: string;
  gstNumber: string;
  businessName: string;
  businessType: string;
  address: string;
}

const unwrap = <T,>(response: ApiEnvelope<T>, fallback: string): T => {
  if (!response?.success || !response.data) throw new Error(response?.message || fallback);
  return response.data;
};

/** Proves the MPIN and returns the token the rest of the flow carries. */
export async function startProfileEdit(mpin: string): Promise<string> {
  const response = await apiRequest<ApiEnvelope<{ editToken: string }>>(
    '/settings/business-profile/verify-mpin',
    { method: 'POST', body: JSON.stringify({ mpin }) },
  );
  return unwrap(response, 'Could not confirm your MPIN.').editToken;
}

/** What the GST registry says about a GSTIN the shop wants to move to. */
export async function previewGstChange(editToken: string, gstNumber: string): Promise<GstPreview> {
  const response = await apiRequest<ApiEnvelope<GstPreview>>(
    '/settings/business-profile/gst-preview',
    { method: 'POST', body: JSON.stringify({ editToken, gstNumber }) },
  );
  return unwrap(response, 'Could not verify that GST number.');
}

/** Sends the code that proves a new number is the shop's own. */
export async function sendProfilePhoneOtp(editToken: string, phone: string): Promise<void> {
  const response = await apiRequest<ApiEnvelope<{ phone: string }>>(
    '/settings/business-profile/phone-otp',
    { method: 'POST', body: JSON.stringify({ editToken, phone }) },
  );
  unwrap(response, 'Could not send the code to that number.');
}

/**
 * Applies whichever changed. `otp` is required only when the phone number is
 * among them, and the server refuses the change rather than trusting this.
 */
export async function applyProfileChanges(
  editToken: string,
  changes: { phone?: string; otp?: string; gstNumber?: string },
): Promise<ProfileUpdateResult> {
  const response = await apiRequest<ApiEnvelope<ProfileUpdateResult>>('/settings/business-profile', {
    method: 'POST',
    body: JSON.stringify({ editToken, ...changes }),
  });
  return unwrap(response, 'Could not save these changes.');
}
