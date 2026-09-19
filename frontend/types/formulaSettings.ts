import type { ActiveFormula } from '@/store/formulaStore';

export interface Formula2Row {
  id: number;
  karat: string;
}

/** How a sales invoice groups what was scanned (Masters → Sales Invoice). */
export type SalesInvoiceLayout = 'SEPARATE' | 'GOLD_WITH_LABOUR' | 'GOLD_WITH_WASTAGE';

export interface FormulaSettings {
  activeFormula: ActiveFormula;
  formula2Rules: string[];
  salesInvoiceLayout: SalesInvoiceLayout;
}

export interface UpdateFormulaSettingsPayload {
  activeFormula: ActiveFormula;
  formula2Rules: string[];
  /** Left out to keep whatever is stored; the server only writes what it is sent. */
  salesInvoiceLayout?: SalesInvoiceLayout;
}
