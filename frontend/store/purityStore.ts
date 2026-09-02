import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_PURITY_ITEMS } from '@/constants/purityData';
import type { PurityItem } from '@/constants/purityData';

interface PurityState {
  items: PurityItem[];
  updateValue: (id: string, value: string) => void;
}

export const usePurityStore = create<PurityState>()(
  persist(
    (set) => ({
      // Standard industry purities (99.60 / 91.60 / 75.00 / 58.50 / 99.99) the
      // shop is expected to edit — a real default, not sample data, so a build
      // wipe deliberately restores these rather than leaving the list empty.
      items: DEFAULT_PURITY_ITEMS,
      updateValue: (id, value) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, value } : item
          ),
        })),
    }),
    {
      name: 'pratham-purity',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
