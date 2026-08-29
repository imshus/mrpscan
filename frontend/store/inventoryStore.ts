import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_INVENTORY_FILES } from '@/constants/inventoryData';
import type { InventoryFile } from '@/types/inventory';

interface InventoryState {
  files: InventoryFile[];
  addFile: (file: InventoryFile) => void;
  removeFile: (id: string) => void;
  resetToDemo: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      files: DEMO_INVENTORY_FILES,
      addFile: (file) =>
        set((state) => ({
          files: [file, ...state.files],
        })),
      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        })),
      resetToDemo: () => set({ files: DEMO_INVENTORY_FILES }),
    }),
    {
      name: 'pratham-inventory',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
