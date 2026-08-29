import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LoginMethod, RegistrationData } from '@/types/auth';

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
      logout: () =>
        set({
          isAuthenticated: false,
          authToken: null,
          refreshToken: null,
          userRole: null,
          loggedInEmployeeId: null,
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
        registration: state.registration,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
