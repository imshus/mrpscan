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
