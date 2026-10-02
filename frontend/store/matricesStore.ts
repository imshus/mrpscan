import { create } from 'zustand';

import {
  DEFAULT_MATRIX_VALUES,
  withOpeningDefaults,
  type MatrixKey,
} from '@/constants/dashboardMatrices';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchDashboardMatrices, updateDashboardMatrices } from '@/utils/matricesApi';
import { registerScopeResetCallback, scopedKey } from '@/utils/userScopedStorage';

/**
 * Whether this shop has ever chosen its Home tiles.
 *
 * The server answers the same way whether a shop saved every tile or never
 * opened the screen: with its own defaults. So a default it no longer agrees
 * with — the 24K RTGS and Cash tiles, switched on by an older server — came
 * back looking exactly like a deliberate choice, and Home showed them.
 *
 * This marker tells the two apart. Until the shop saves on Dashboard
 * Settings, the app's own default stands and Home opens on MCX alone. The
 * moment it saves, the server is the authority again, on every device.
 */
const CHOSE_TILES_KEY = 'pratham-matrices-chosen';

async function hasChosenTiles(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(scopedKey(CHOSE_TILES_KEY))) === '1';
  } catch {
    // Unreadable storage must not start switching tiles on by itself.
    return false;
  }
}

function rememberChoice(): void {
  AsyncStorage.setItem(scopedKey(CHOSE_TILES_KEY), '1').catch(() => {});
}

/** The bhaw source is picked elsewhere and is not a rate tile. */
const isRateKey = (key: string) => key !== 'bhaw_source_jmd';

interface MatricesState {
  values: Record<MatrixKey, boolean>;
  isLoaded: boolean;
  toggle: (key: MatrixKey) => void;
  setValue: (key: MatrixKey, value: boolean) => void;
  applyValues: (values: Record<MatrixKey, boolean>) => Promise<void>;
  fetchValues: () => Promise<void>;
}

export const useMatricesStore = create<MatricesState>()((set) => ({
  // (registered below: this in-memory store resets when the account changes)
  values: { ...DEFAULT_MATRIX_VALUES },
  isLoaded: false,
  toggle: (key) =>
    set((state) => ({
      values: { ...state.values, [key]: !state.values[key] },
    })),
  setValue: (key, value) =>
    set((state) => ({
      values: { ...state.values, [key]: value },
    })),
  applyValues: async (values) => {
    // Saving here is the choice itself, whatever the server then says.
    rememberChoice();
    try {
      const updated = await updateDashboardMatrices(values);
      if (updated) {
        // Server response wins per key, but keys it doesn't know about keep the
        // value the user just chose instead of snapping back to the default.
        set({ values: withOpeningDefaults({ ...values, ...updated }) });
      } else {
        set({ values: withOpeningDefaults(values) });
      }
    } catch (e) {
      console.error(e);
      set({ values });
    }
  },
  fetchValues: async () => {
    const [fetched, chosen] = await Promise.all([
      fetchDashboardMatrices(),
      hasChosenTiles(),
    ]);
    if (fetched) {
      // A shop that has chosen gets exactly what it saved. One that has not
      // gets the app's default for the rate tiles — MCX alone — because what
      // came back for those is the server's default, not anybody's decision.
      const fromServer = chosen
        ? fetched
        : Object.fromEntries(Object.entries(fetched).filter(([key]) => !isRateKey(key)));
      set((state) => ({
        values: withOpeningDefaults({ ...state.values, ...fromServer }),
        isLoaded: true,
      }));
    } else {
      set({ isLoaded: true });
    }
  },
}));

// This store has no persistence, so the account-switch rehydration cannot
// reach it — without this reset, the previous account's toggles and bhaw
// source would show on the next account's home screen until (and, when the
// refetch fails, long after) its own settings load.
registerScopeResetCallback(() => {
  useMatricesStore.setState({ values: { ...DEFAULT_MATRIX_VALUES }, isLoaded: false });
});
