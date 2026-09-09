import { apiRequest } from '@/utils/apiClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export interface BusinessProfileResponse {
  businessId: string;
  businessName: string;
  legalName: string;
  gstNumber: string;
  businessType: string;
  address: string;
  stateName: string;
  pincode: string;
  phone: string;
  /** The handle this user signs in with. */
  loginId: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
  invoiceTerms: string[];
}

/**
 * GET /settings/business-profile — the business identity as it stands in the
 * database.
 *
 * The app otherwise only captures these at login, so a rename, or a GST record
 * repaired after signup, would keep showing the stale copy until the next
 * sign-in. Returns null on failure so callers keep displaying the cached copy
 * rather than blanking the screen.
 */
export type EInvoiceMode = 'live' | 'test';

export interface EInvoiceSettings {
  enabled: boolean;
  /** live registers with the IRP; test prints a labelled specimen band. */
  mode: EInvoiceMode;
  username: string;
  /** Whether a password is saved server-side; the password itself never returns. */
  hasPassword: boolean;
}

/** GET /settings/einvoice — the business's IRP e-invoicing state (owner only). */
export async function fetchEInvoiceSettings(): Promise<EInvoiceSettings | null> {
  try {
    const response = await apiRequest<ApiEnvelope<EInvoiceSettings>>('/settings/einvoice', {
      method: 'GET',
    });
    return response.success && response.data ? response.data : null;
  } catch (error) {
    console.warn('Failed to fetch e-invoice settings', error);
    return null;
  }
}

/**
 * POST /settings/einvoice — saves the IRP API user for this business. An
 * omitted password keeps the stored one. Throws with the server's message so
 * the screen can show why a save was refused.
 */
export async function updateEInvoiceSettings(payload: {
  enabled?: boolean;
  mode?: EInvoiceMode;
  username?: string;
  password?: string;
}): Promise<EInvoiceSettings> {
  const response = await apiRequest<ApiEnvelope<EInvoiceSettings>>('/settings/einvoice', {
    method: 'POST',
    body: payload,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Could not save e-invoice settings.');
  }
  return response.data;
}

export async function fetchBusinessProfile(): Promise<BusinessProfileResponse | null> {
  try {
    const response = await apiRequest<ApiEnvelope<BusinessProfileResponse>>(
      '/settings/business-profile',
      { method: 'GET' },
    );
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch business profile', error);
    return null;
  }
}
