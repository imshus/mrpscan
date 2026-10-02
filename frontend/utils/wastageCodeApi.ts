import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData, unwrapApiList } from '@/utils/apiResponse';

/** One line of Masters → Wastage: a code and the wastage percentage it carries. */
export interface WastageCode {
  id: string;
  code: string;
  /** Null means the shop has not given a figure, which is not the same as zero. */
  percent: number | null;
}

type RawWastageCode = {
  _id?: string;
  id?: string;
  code?: string;
  percent?: number | string | null;
};

function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toWastageCode(raw: RawWastageCode): WastageCode | null {
  const id = String(raw.id ?? raw._id ?? '').trim();
  const code = String(raw.code ?? '').trim();
  if (!id || !code) return null;
  return { id, code, percent: toOptionalNumber(raw.percent) };
}

export async function fetchWastageCodes(): Promise<WastageCode[]> {
  const response = await apiRequest<Record<string, unknown>>('/wastage-codes', { method: 'GET' });
  return unwrapApiList(response)
    .map((row) => toWastageCode(row as RawWastageCode))
    .filter((row): row is WastageCode => row !== null);
}

/** Creates a code, or edits the one whose id is given; returns the saved row. */
export async function saveWastageCode(payload: {
  id?: string;
  code: string;
  /** Empty string clears the figure; the server stores null for it. */
  percent?: string | number | null;
}): Promise<WastageCode | null> {
  const response = await apiRequest<Record<string, unknown>>('/wastage-codes', {
    method: 'POST',
    body: {
      ...(payload.id ? { id: payload.id } : {}),
      code: payload.code,
      percent: payload.percent ?? '',
    },
  });
  return toWastageCode(unwrapApiData(response) as RawWastageCode);
}

export async function deleteWastageCode(id: string): Promise<void> {
  await apiRequest(`/wastage-codes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
