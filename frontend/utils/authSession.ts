import { useAuthStore } from '@/store/authStore';
import { loginBusiness } from '@/utils/authApi';

interface BusinessSessionPayload {
  accessToken: string;
  refreshToken?: string;
  businessName?: string;
  gstNumber?: string;
  businessType?: string;
  address?: string;
  phone?: string;
  role?: string;
  loginId?: string;
  fullName?: string;
}

/**
 * Puts a signed-in session into the store: the tokens, the role, and the
 * business identity the payload carries. The same writes the login screen
 * makes, so a session opened anywhere else behaves identically.
 */
export function applyBusinessSession(payload: BusinessSessionPayload, loginId: string): void {
  const store = useAuthStore.getState();

  store.setAuthToken(payload.accessToken);
  if (payload.refreshToken) store.setRefreshToken(payload.refreshToken);

  if (payload.role === 'EMP') {
    store.setUserRole('employee');
    store.setIsSuper(false);
  } else {
    store.setUserRole('business');
    store.setIsSuper(payload.role === 'SUPER');
  }

  store.setLoggedInEmployee(null);

  store.updateRegistration({
    businessName: payload.businessName || '',
    gstNumber: payload.gstNumber || '',
    businessType: payload.businessType || '',
    address: payload.address || '',
    // Only ever the real phone number: the login ID in this field surfaces
    // wherever the app shows the user's number.
    phone: payload.phone || '',
    userId: payload.loginId || loginId,
    ...(payload.fullName ? { fullName: payload.fullName } : {}),
  });

  store.setAuthenticated(true);
}

/**
 * Signs the person in with the credentials they just registered with, so a
 * finished signup goes to Home instead of asking for them again.
 *
 * Nothing is written to the store until the returned `activate` is called —
 * the signup screens show their "account created" moment first, and setting
 * the session live navigates away.
 *
 * Sign-in is by User ID (the server stopped accepting a phone number here),
 * which is why the earlier attempt with `phone` always failed and dropped
 * the new shop on the login screen.
 */
export async function prepareSignInAfterSignup(
  loginId: string | undefined,
  password: string | undefined,
): Promise<{ activate: () => void } | null> {
  const id = String(loginId ?? '').trim();
  if (!id || !password) return null;

  const result = await loginBusiness(id, password);
  if (!result.success || !result.data) return null;

  const payload = result.data;
  return { activate: () => applyBusinessSession(payload, id) };
}
