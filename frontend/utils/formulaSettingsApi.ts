import type {
  Formula2Row,
  FormulaSettings,
  UpdateFormulaSettingsPayload,
} from '@/types/formulaSettings';
import type { ActiveFormula } from '@/store/formulaStore';
import { useFormulaStore } from '@/store/formulaStore';
import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';
import { normalizeKarat } from '@/utils/formulaUtils';

type ApiEnvelope = Record<string, unknown> & {
  success?: boolean;
  data?: unknown;
};

const DEFAULT_FORMULA2_RULES = ['14K'];

function normalizeActiveFormula(value: unknown): ActiveFormula {
  return value === 'F2' ? 'F2' : 'F1';
}

function normalizeFormula2Rules(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_FORMULA2_RULES];
  }

  const rules = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeKarat(item))
    .filter((item) => item !== '');

  return rules.length > 0 ? rules : [...DEFAULT_FORMULA2_RULES];
}

function normalizeFormulaSettings(raw: Record<string, unknown>): FormulaSettings {
  return {
    activeFormula: normalizeActiveFormula(raw.activeFormula),
    formula2Rules: normalizeFormula2Rules(raw.formula2Rules),
  };
}

export function applyFormulaSettingsToStore(settings: FormulaSettings): void {
  useFormulaStore.getState().setActiveFormula(settings.activeFormula);
  useFormulaStore.getState().setFormula2Rules(settings.formula2Rules);
}

export async function syncFormulaStoreFromApi(): Promise<FormulaSettings> {
  const settings = await fetchFormulaSettings();
  applyFormulaSettingsToStore(settings);
  return settings;
}

export function formula2RulesToRows(rules: string[]): { rows: Formula2Row[]; nextRowId: number } {
  const rows = rules.map((karat, index) => ({
    id: index + 1,
    karat,
  }));

  return {
    rows,
    nextRowId: rows.length + 1,
  };
}

export async function fetchFormulaSettings(): Promise<FormulaSettings> {
  const response = await apiRequest<ApiEnvelope>('/settings/formula', { method: 'GET' });
  const unwrapped = unwrapApiData(response);
  return normalizeFormulaSettings(unwrapped as Record<string, unknown>);
}

export async function updateFormulaSettings(
  payload: UpdateFormulaSettingsPayload,
): Promise<FormulaSettings> {
  const response = await apiRequest<ApiEnvelope>('/settings/formula', {
    method: 'POST',
    body: {
      activeFormula: payload.activeFormula,
      formula2Rules: payload.formula2Rules,
    },
  });
  const unwrapped = unwrapApiData(response);
  return normalizeFormulaSettings(unwrapped as Record<string, unknown>);
}
