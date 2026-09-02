import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryFile } from '@/types/inventory';

interface InventoryState {
  files: InventoryFile[];
  addFile: (file: InventoryFile) => void;
  removeFile: (id: string) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      // Starts empty on purpose. zustand persist falls back to this default
      // whenever the stored key is missing, so seeding demo files here meant a
      // storage wipe *restored* sample inventory instead of clearing it.
      files: [],
      addFile: (file) =>
        set((state) => ({
          files: [file, ...state.files],
        })),
      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        })),
    }),
    {
      name: 'pratham-inventory',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
