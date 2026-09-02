import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The build this session belongs to.
 *
 * Installing a new APK over an existing one keeps the app's stored data, so a
 * tester would carry the previous session into the new build without ever
 * seeing the login screen. Sessions are therefore scoped to the build that
 * created them and discarded when the version changes.
 *
 * This is the second line of defence only. The primary mechanism is
 * `utils/appBuildReset.ts`, which wipes *every* persisted store before the
 * navigator mounts; the check below still runs so a failed or skipped wipe
 * cannot leave the previous build's session signed in. Both read the same
 * `Constants.expoConfig?.version`, so they agree on what "a new build" means.
 */
const APP_BUILD = String(Constants.expoConfig?.version ?? 'dev');

import type { LoginMethod, RegistrationData } from '@/types/auth';

function getPersistedRegistration(
  registration: Partial<RegistrationData>,
): Partial<RegistrationData> {
  const safeRegistration = { ...registration };
  delete safeRegistration.password;
  delete safeRegistration.phoneError;
  delete safeRegistration.userIdError;
  delete safeRegistration.passwordError;
  return safeRegistration;
}

export type UserRole = 'business' | 'employee' | null;

interface AuthState {
  isAuthenticated: boolean;
  isSuper: boolean;
  authToken: string | null;
  refreshToken: string | null;
  userRole: UserRole;
  loggedInEmployeeId: string | null;
  rememberMe: boolean;
  loginMethod: LoginMethod;
  savedPhone: string;
  savedEmployeePhone: string;
  registration: Partial<RegistrationData>;
  _hasHydrated: boolean;
  setAuthenticated: (value: boolean) => void;
  setAuthToken: (token: string | null) => void;
  setIsSuper: (value: boolean) => void;
  setRefreshToken: (token: string | null) => void;
  setUserRole: (role: UserRole) => void;
  setLoggedInEmployee: (id: string | null) => void;
  setRememberMe: (value: boolean) => void;
  setLoginMethod: (method: LoginMethod) => void;
  setSavedCredentials: (phone: string) => void;
  setSavedEmployeePhone: (phone: string) => void;
  updateRegistration: (data: Partial<RegistrationData>) => void;
  resetRegistration: () => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isSuper: false,
      authToken: null,
      refreshToken: null,
      userRole: null,
      loggedInEmployeeId: null,
      rememberMe: false,
      loginMethod: 'password',
      savedPhone: '',
      savedEmployeePhone: '',
      registration: {},
      _hasHydrated: false,
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setAuthToken: (token) => set({ authToken: token }),
      setIsSuper: (value) => set({ isSuper: value }),
      setRefreshToken: (token) => set({ refreshToken: token }),
      setUserRole: (role) => set({ userRole: role }),
      setLoggedInEmployee: (id) => set({ loggedInEmployeeId: id }),
      setRememberMe: (value) => set({ rememberMe: value }),
      setLoginMethod: (method) => set({ loginMethod: method }),
      setSavedCredentials: (phone) => set({ savedPhone: phone }),
      setSavedEmployeePhone: (phone) => set({ savedEmployeePhone: phone }),
      updateRegistration: (data) =>
        set((state) => ({ registration: { ...state.registration, ...data } })),
      resetRegistration: () => set({ registration: {} }),
      // Clears the signed-in business too. Leaving `registration` behind meant
      // the next account signed in on this device inherited the previous
      // business's name, GSTIN and address until its own data arrived.
      logout: () =>
        set({
          isAuthenticated: false,
          authToken: null,
          refreshToken: null,
          userRole: null,
          isSuper: false,
          loggedInEmployeeId: null,
          registration: {},
        }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'pratham-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        authToken: state.authToken,
        refreshToken: state.refreshToken,
        userRole: state.userRole,
        isSuper: state.isSuper,
        loggedInEmployeeId: state.loggedInEmployeeId,
        rememberMe: state.rememberMe,
        savedPhone: state.savedPhone,
        savedEmployeePhone: state.savedEmployeePhone,
        loginMethod: state.loginMethod,
        registration: getPersistedRegistration(state.registration),
        appBuild: APP_BUILD,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!state) return;

        // A session restored from a different build is not trusted: the new
        // APK asks for credentials rather than reusing what was cached. The
        // remembered identifiers go too, so nothing from the previous install
        // can sign anyone in or be offered back in the login fields.
        const restoredBuild = (state as { appBuild?: string }).appBuild;
        if (!error && restoredBuild !== APP_BUILD) {
          state.logout();
          state.setSavedCredentials('');
          state.setSavedEmployeePhone('');
          state.setRememberMe(false);
        }

        state.setHasHydrated(true);
      },
    },
  ),
);
