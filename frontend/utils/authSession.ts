import { DEFAULT_MATRIX_VALUES } from '@/constants/dashboardMatrices';
import { useAuthStore } from '@/store/authStore';
import { useMatricesStore } from '@/store/matricesStore';
import { loginBusiness } from '@/utils/authApi';
import { updateDashboardMatrices } from '@/utils/matricesApi';

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
 *
 * `authenticate: false` leaves the session inert — everything is in place but
 * the app has not been told to show the dashboard yet.
 */
export function applyBusinessSession(
  payload: BusinessSessionPayload,
  loginId: string,
  { authenticate = true }: { authenticate?: boolean } = {},
): void {
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

  if (authenticate) store.setAuthenticated(true);
}

/**
 * Saves a new shop's dashboard choice: the 24K price and nothing else.
 *
 * A shop that has saved nothing is served the API's own defaults, which on an
 * older deployment is every rate — so a brand new Home arrived covered in
 * karat cards whatever the app preferred. Writing the choice once, here, makes
 * the record itself say 24K, for this phone and every later sign-in.
 *
 * A failure is not worth stopping a sign-in for: the app's own default is the
 * same set, so Home still opens on 24K until a later save succeeds.
 */
async function seedDashboardDefaults(): Promise<void> {
  const values = { ...DEFAULT_MATRIX_VALUES };
  useMatricesStore.setState({ values, isLoaded: true });
  try {
    await updateDashboardMatrices(values);
  } catch (error) {
    console.warn('[Signup] Could not save the starting dashboard settings', error);
  }
}

/**
 * Signs the person in with the credentials they just registered with, so a
 * finished signup goes to Home instead of asking for them again.
 *
 * Nothing is shown until the returned `activate` is called — the signup
 * screens show their "account created" moment first, and a live session
 * navigates away from it.
 *
 * Sign-in is by User ID (the server stopped accepting a phone number here),
 * which is why the earlier attempt with `phone` always failed and dropped the
 * new shop on the login screen.
 */
export async function prepareSignInAfterSignup(
  loginId: string | undefined,
  credential: string | { mpin?: string; password?: string } | undefined,
): Promise<{ activate: () => Promise<void> } | null> {
  const id = String(loginId ?? '').trim();
  const secret = typeof credential === 'string' ? { password: credential } : (credential || {});
  if (!id || !(secret.mpin || secret.password)) return null;

  const result = await loginBusiness(id, secret);
  if (!result.success || !result.data) return null;

  const payload = result.data;
  return {
    activate: async () => {
      // The session first, so the save below is made as this shop; the
      // dashboard is shown only once its starting settings are stored.
      applyBusinessSession(payload, id, { authenticate: false });
      await seedDashboardDefaults();
      useAuthStore.getState().setAuthenticated(true);
    },
  };
}
