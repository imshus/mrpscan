import { create } from 'zustand';

import {
  DEFAULT_MATRIX_VALUES,
  type MatrixKey,
} from '@/constants/dashboardMatrices';
import { fetchDashboardMatrices, updateDashboardMatrices } from '@/utils/matricesApi';

interface MatricesState {
  values: Record<MatrixKey, boolean>;
  isLoaded: boolean;
  toggle: (key: MatrixKey) => void;
  setValue: (key: MatrixKey, value: boolean) => void;
  applyValues: (values: Record<MatrixKey, boolean>) => Promise<void>;
  fetchValues: () => Promise<void>;
}

export const useMatricesStore = create<MatricesState>()((set) => ({
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
    try {
      const updated = await updateDashboardMatrices(values);
      if (updated) {
        // Server response wins per key, but keys it doesn't know about keep the
        // value the user just chose instead of snapping back to the default.
        set({ values: { ...DEFAULT_MATRIX_VALUES, ...values, ...updated } });
      } else {
        set({ values });
      }
    } catch (e) {
      console.error(e);
      set({ values });
    }
  },
  fetchValues: async () => {
    const fetched = await fetchDashboardMatrices();
    if (fetched) {
      set((state) => ({
        values: { ...DEFAULT_MATRIX_VALUES, ...state.values, ...fetched },
        isLoaded: true,
      }));
    } else {
      set({ isLoaded: true });
    }
  },
}));
