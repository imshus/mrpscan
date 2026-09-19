import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData, unwrapApiList } from '@/utils/apiResponse';

export interface ItemCode {
  id: string;
  code: string;
  description: string;
  /**
   * What this kind of item usually carries. Null means the shop has not said,
   * which is not the same as zero — no wastage and zero wastage price
   * differently — so neither is turned into the other on the way through.
   */
  wastage: number | null;
  labour: number | null;
}

type RawItemCode = {
  _id?: string;
  id?: string;
  code?: string;
  description?: string;
  wastage?: number | string | null;
  labour?: number | string | null;
};

/** A figure the shop may not have given: blank and zero stay distinct. */
function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toItemCode(raw: RawItemCode): ItemCode | null {
  const id = String(raw.id ?? raw._id ?? '').trim();
  const code = String(raw.code ?? '').trim();
  if (!id || !code) return null;
  return {
    id,
    code,
    description: String(raw.description ?? '').trim(),
    wastage: toOptionalNumber(raw.wastage),
    labour: toOptionalNumber(raw.labour),
  };
}

export async function fetchItemCodes(): Promise<ItemCode[]> {
  const response = await apiRequest<Record<string, unknown>>('/item-codes', { method: 'GET' });
  return unwrapApiList(response)
    .map((row) => toItemCode(row as RawItemCode))
    .filter((row): row is ItemCode => row !== null);
}

/** Creates a code, or renames/redescribes the one whose id is given; returns the saved row. */
export async function saveItemCode(payload: {
  id?: string;
  code: string;
  description?: string;
  /** Empty string clears the figure; the server stores null for it. */
  wastage?: string | number | null;
  labour?: string | number | null;
}): Promise<ItemCode | null> {
  const response = await apiRequest<Record<string, unknown>>('/item-codes', {
    method: 'POST',
    body: {
      ...(payload.id ? { id: payload.id } : {}),
      code: payload.code,
      description: payload.description ?? '',
      wastage: payload.wastage ?? '',
      labour: payload.labour ?? '',
    },
  });
  return toItemCode(unwrapApiData(response) as RawItemCode);
}

export async function deleteItemCode(id: string): Promise<void> {
  await apiRequest(`/item-codes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
