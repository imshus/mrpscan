import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

export interface ItemCode {
  id: string;
  code: string;
  description: string;
}

type RawItemCode = { _id?: string; id?: string; code?: string; description?: string };

function toItemCode(raw: RawItemCode): ItemCode | null {
  const id = String(raw.id ?? raw._id ?? '').trim();
  const code = String(raw.code ?? '').trim();
  if (!id || !code) return null;
  return { id, code, description: String(raw.description ?? '').trim() };
}

export async function fetchItemCodes(): Promise<ItemCode[]> {
  const response = await apiRequest<Record<string, unknown>>('/item-codes', { method: 'GET' });
  const data = unwrapApiData(response);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => toItemCode(row as RawItemCode))
    .filter((row): row is ItemCode => row !== null);
}

/** Creates a code, or renames/redescribes the one whose id is given; returns the saved row. */
export async function saveItemCode(payload: {
  id?: string;
  code: string;
  description?: string;
}): Promise<ItemCode | null> {
  const response = await apiRequest<Record<string, unknown>>('/item-codes', {
    method: 'POST',
    body: {
      ...(payload.id ? { id: payload.id } : {}),
      code: payload.code,
      description: payload.description ?? '',
    },
  });
  return toItemCode(unwrapApiData(response) as RawItemCode);
}

export async function deleteItemCode(id: string): Promise<void> {
  await apiRequest(`/item-codes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
