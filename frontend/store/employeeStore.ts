import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Employee } from '@/types/employee';

interface EmployeeState {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  removeEmployee: (id: string) => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set, get) => ({
      employees: [],
      setEmployees: (employees) => set({ employees }),
      addEmployee: (employee) =>
        set((state) => ({
          employees: [employee, ...state.employees],
        })),
      updateEmployee: (id, data) =>
        set((state) => ({
          employees: state.employees.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      removeEmployee: async (id) => {
        const previous = get().employees;
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        }));
        
        try {
          const { deleteEmployeeApi } = require('@/utils/employeeApi');
          const result = await deleteEmployeeApi(id);
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete employee');
          }
        } catch (error) {
          set({ employees: previous });
          throw error;
        }
      },
    }),
    {
      name: 'pratham-employees',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
