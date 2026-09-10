import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

/** Settings the server hands the app; none need a login. */
export interface AppConfig {
  /** Where the 24/7 voice agent is hosted; empty when the server has not set it. */
  prathamAiUrl: string;
}

let cached: AppConfig | null = null;

/**
 * GET /app-config, remembered for the session once it succeeds. A failed
 * request answers empty values rather than throwing, so a screen can fall
 * back to its build-time defaults.
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  if (cached) return cached;
  try {
    const response = await apiRequest<Record<string, unknown>>('/app-config', {
      method: 'GET',
      timeoutMs: 8000,
    });
    const data = unwrapApiData(response) as Record<string, unknown> | null;
    cached = { prathamAiUrl: String(data?.prathamAiUrl ?? '').trim() };
    return cached;
  } catch {
    return { prathamAiUrl: '' };
  }
}
