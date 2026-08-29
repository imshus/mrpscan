import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_V1_PREFIX = '/api/v1';
const PROD_FALLBACK_API_URL = 'https://amitaash.com';

function getMetroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)?.extra
      ?.expoClient?.hostUri ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;

  if (!hostUri) return null;
  return hostUri.split(':')[0] ?? null;
}

function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  return withProtocol
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
    .replace(/\/api$/i, '');
}

export function resolveApiBaseUrl(): string {
  // 1. ALWAYS prioritize explicitly set .env variables first!
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  console.log('[API] EXPO_PUBLIC_API_URL:', envUrl ?? 'undefined');
  if (envUrl) {
    const normalizedEnvUrl = normalizeBaseUrl(envUrl);
    console.log('[API] Using EXPO_PUBLIC_API_URL as base:', normalizedEnvUrl);
    return normalizedEnvUrl;
  }

  // 2. Fallbacks for local development
  if (__DEV__) {
    const metroHost = getMetroHost();
    console.log('[API] __DEV__ metroHost:', metroHost ?? 'undefined');
    if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
      console.log('[API] Using Metro host base:', `http://${metroHost}:3000`);
      return `http://${metroHost}:3000`;
    }

    if (Platform.OS === 'android') {
      console.log('[API] Using Android emulator base:', 'http://10.0.2.2:3000');
      return 'http://10.0.2.2:3000';
    }
  }

  if (!__DEV__) {
    const fallbackUrl = normalizeBaseUrl(PROD_FALLBACK_API_URL);
    console.log('[API] Using production fallback base:', fallbackUrl);
    return fallbackUrl;
  }

  console.log('[API] Falling back to production base:', 'https://amitaash.com');
  return 'https://amitaash.com';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${API_V1_PREFIX}${path}`;
}

export async function waitForMockDelay(ms = 800): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
