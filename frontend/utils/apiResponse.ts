import type { StructuredScanData } from '@/types/scanner';

type ApiFieldValue =
  | string
  | number
  | { value?: string | number | null; confidence?: number }
  | unknown[];

function flattenStoneArrayItem(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const nested = (value as { value?: string | number | null }).value;
      if (nested != null && String(nested).trim() !== '') {
        result[key] = String(nested);
      }
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized) {
        result[key] = normalized;
      }
    }
  }
  return result;
}

/** Gemini returns { field: { value, confidence } }; review API uses flat strings. */
export function flattenStructuredData(data: unknown): StructuredScanData {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const result: StructuredScanData = {};

  for (const [key, raw] of Object.entries(data as Record<string, ApiFieldValue>)) {
    if (raw == null) continue;

    if (Array.isArray(raw) && (key === 'diamonds' || key === 'colorstones')) {
      const flattenedItems = raw
        .map((item) => flattenStoneArrayItem(item))
        .filter((item) => Object.keys(item).length > 0);
      if (flattenedItems.length > 0) {
        result[key] = JSON.stringify(flattenedItems);
      }
      continue;
    }

    if (typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
      const value = raw.value;
      if (value != null && String(value).trim() !== '') {
        result[key] = String(value);
      }
      continue;
    }

    if (typeof raw === 'string' || typeof raw === 'number') {
      const value = String(raw).trim();
      if (value) {
        result[key] = value;
      }
    }
  }

  return result;
}

export function unwrapApiData<T extends Record<string, unknown>>(response: T): T;
export function unwrapApiData<T>(response: T | { data?: T }): T;
export function unwrapApiData(response: unknown): unknown {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    response.data &&
    typeof response.data === 'object' &&
    !Array.isArray(response.data)
  ) {
    return response.data;
  }
  return response;
}
