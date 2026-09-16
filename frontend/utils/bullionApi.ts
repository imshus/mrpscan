import { apiRequest } from '@/utils/apiClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export interface BullionHouse {
  /** What the app sends back when this house is chosen. */
  key: string;
  label: string;
  /** True for the two houses that publish to the live bhaw feed. */
  live: boolean;
}

export interface BullionSources {
  houses: BullionHouse[];
  selected: string;
  /** Just the shop's own additions, as the server stores them. */
  customNames: string[];
}

function normalize(raw: unknown): BullionSources | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const builtIn = Array.isArray(record.builtIn) ? record.builtIn : [];
  const customNames = Array.isArray(record.customNames)
    ? record.customNames.map((name) => String(name)).filter(Boolean)
    : [];

  const houses: BullionHouse[] = [
    ...builtIn.map((house) => {
      const entry = (house ?? {}) as Record<string, unknown>;
      return {
        key: String(entry.key ?? ''),
        label: String(entry.label ?? entry.key ?? ''),
        live: true,
      };
    }).filter((house) => house.key),
    // A house the shop added follows no vendor: its rate is the shop's own.
    ...customNames.map((name) => ({ key: name, label: name, live: false })),
  ];

  return {
    houses,
    customNames,
    selected: String(record.selected ?? ''),
  };
}

/** GET /settings/bullion — the houses to choose from and the one being followed. */
export async function fetchBullionSources(): Promise<BullionSources | null> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/settings/bullion', {
      method: 'GET',
    });
    return response.success ? normalize(response.data) : null;
  } catch (error) {
    console.warn('Failed to load the bullion houses', error);
    return null;
  }
}

/**
 * POST /settings/bullion — the whole choice: which house is followed and the
 * shop's own list. Throws with the server's message so the screen can say why
 * a name was refused.
 */
export async function updateBullionSources(payload: {
  selected: string;
  customNames: string[];
}): Promise<BullionSources> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/settings/bullion', {
    method: 'POST',
    body: payload,
  });
  const normalized = response.success ? normalize(response.data) : null;
  if (!normalized) throw new Error(response.message || 'Could not save the bullion house.');
  return normalized;
}
