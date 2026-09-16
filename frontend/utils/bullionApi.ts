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
}

export interface BullionSources {
  /** The houses that can be followed: the ones on the live bhaw feed. */
  houses: BullionHouse[];
  selected: string;
  /** Houses the shop has asked us to add. Not selectable until their rates exist. */
  requestedNames: string[];
}

function normalize(raw: unknown): BullionSources | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const builtIn = Array.isArray(record.builtIn) ? record.builtIn : [];
  const requestedRaw = record.requestedNames ?? record.customNames;
  const requestedNames = Array.isArray(requestedRaw)
    ? requestedRaw.map((name) => String(name)).filter(Boolean)
    : [];

  // A requested house is deliberately NOT a choice here: it has no rates yet,
  // so offering it would price a shop's gold off nothing.
  const houses: BullionHouse[] = builtIn
    .map((house) => {
      const entry = (house ?? {}) as Record<string, unknown>;
      return {
        key: String(entry.key ?? ''),
        label: String(entry.label ?? entry.key ?? ''),
      };
    })
    .filter((house) => house.key);

  return {
    houses,
    requestedNames,
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
  requestedNames: string[];
}): Promise<BullionSources> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/settings/bullion', {
    method: 'POST',
    body: payload,
  });
  const normalized = response.success ? normalize(response.data) : null;
  if (!normalized) throw new Error(response.message || 'Could not save the bullion house.');
  return normalized;
}
