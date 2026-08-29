import type { ActiveFormula } from '@/store/formulaStore';

export interface Formula2Row {
  id: number;
  karat: string;
}

export interface FormulaSettings {
  activeFormula: ActiveFormula;
  formula2Rules: string[];
}

export interface UpdateFormulaSettingsPayload {
  activeFormula: ActiveFormula;
  formula2Rules: string[];
}
