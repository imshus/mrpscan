import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData, unwrapApiList } from '@/utils/apiResponse';
import {
  toLabourCode,
  type LabourCode,
  type LabourCodeUnit,
  type RawLabourCode,
} from '@/utils/labourCodes';

export type { LabourCode, LabourCodeUnit } from '@/utils/labourCodes';

/** Masters → Labour Code, A to Z: this user's own list, else the shop's. */
export async function fetchLabourCodes(): Promise<LabourCode[]> {
  const response = await apiRequest<Record<string, unknown>>('/labour-codes', { method: 'GET' });
  return unwrapApiList(response)
    .map((row) => toLabourCode(row as RawLabourCode))
    .filter((row): row is LabourCode => row !== null);
}

/** Creates a code, or edits the one whose id is given; returns the saved row. */
export async function saveLabourCode(payload: {
  id?: string;
  code: string;
  /** Required: the server refuses a blank rate (400 "Labour rate is required"). */
  rate: string | number;
  unit: LabourCodeUnit;
}): Promise<LabourCode | null> {
  const response = await apiRequest<Record<string, unknown>>('/labour-codes', {
    method: 'POST',
    body: {
      ...(payload.id ? { id: payload.id } : {}),
      code: payload.code,
      rate: payload.rate,
      unit: payload.unit,
    },
  });
  return toLabourCode(unwrapApiData(response) as RawLabourCode);
}

export async function deleteLabourCode(id: string): Promise<void> {
  await apiRequest(`/labour-codes/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
