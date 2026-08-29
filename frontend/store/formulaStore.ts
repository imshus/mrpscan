import { create } from 'zustand';

export type ActiveFormula = 'F1' | 'F2';

interface FormulaState {
  activeFormula: ActiveFormula;
  formula2Rules: string[];
  setActiveFormula: (formula: ActiveFormula) => void;
  setFormula2Rules: (rules: string[]) => void;
  updateFormula2Rule: (index: number, karat: string) => void;
  addFormula2Rule: (karat: string) => void;
  removeFormula2Rule: (index: number) => void;
}

export const useFormulaStore = create<FormulaState>((set) => ({
  activeFormula: 'F1',
  formula2Rules: ['14K'],
  setActiveFormula: (formula) => set({ activeFormula: formula }),
  setFormula2Rules: (rules) => set({ formula2Rules: rules }),
  updateFormula2Rule: (index, karat) =>
    set((state) => ({
      formula2Rules: state.formula2Rules.map((rule, i) => (i === index ? karat : rule)),
    })),
  addFormula2Rule: (karat) =>
    set((state) => ({
      formula2Rules: [...state.formula2Rules, karat],
    })),
  removeFormula2Rule: (index) =>
    set((state) => ({
      formula2Rules: state.formula2Rules.filter((_, i) => i !== index),
    })),
}));
