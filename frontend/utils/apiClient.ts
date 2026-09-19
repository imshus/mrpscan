import { API_BASE_URL, getApiUrl } from '@/constants/api';
import { useAuthStore } from '@/store/authStore';
import {
  currentScopeGeneration,
  currentUserScope,
  registerScopeResetCallback,
} from '@/utils/userScopedStorage';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'signal'> & {
  body?: BodyInit | Record<string, unknown> | null;
  skipJson?: boolean;
  timeoutMs?: number;
  /**
   * Optional caller-owned abort signal. Aborting it cancels the in-flight
   * request (including the post-refresh retry) and rejects with an ApiError
   * whose message is REQUEST_ABORTED_MESSAGE. The internal timeout keeps
   * working independently of this signal.
   */
  signal?: AbortSignal;
};

export const REQUEST_ABORTED_MESSAGE = 'Request aborted';

/** True when `error` came from an aborted request (caller signal or raw AbortError). */
export function isRequestAbortedError(error: unknown): boolean {
  if ((error as Error)?.name === 'AbortError') return true;
  return error instanceof ApiError && error.message === REQUEST_ABORTED_MESSAGE;
}

/**
 * Forwards an abort from the caller's signal to the internal controller.
 * Returns an unlink function that must be called once the request settles.
 */
function linkAbortSignal(controller: AbortController, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  return () => signal.removeEventListener('abort', onAbort);
}

const getResponseCache = new Map<string, unknown>();

const SENSITIVE_LOG_KEY = /password|otp|token|secret|authorization/i;

function redactSensitiveLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveLogValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_LOG_KEY.test(key) ? '***' : redactSensitiveLogValue(nestedValue),
    ]),
  );
}

function toLoggableBody(
  requestBody: BodyInit | undefined,
  contentType: string | null,
): unknown {
  if (requestBody instanceof FormData) {
    return '[FormData]';
  }

  if (typeof requestBody === 'string' && contentType?.includes('application/json')) {
    try {
      return redactSensitiveLogValue(JSON.parse(requestBody));
    } catch {
      return '[JSON body]';
    }
  }

  return requestBody;
}

function getNetworkErrorMessage(): string {
  return `Cannot reach the server (${API_BASE_URL}). If you are on a phone, set EXPO_PUBLIC_API_URL to your backend URL and make sure the backend is running.`;
}

let refreshPromise: Promise<string | null> | null = null;
let refreshController: AbortController | null = null;
const REFRESH_TIMEOUT_MS = 20000;

// An account change ends a refresh still in flight: its tokens would be the
// previous account's, and installing them would hand the next person that
// account's whole session.
registerScopeResetCallback(() => {
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
});

async function handleTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const issuedAt = currentScopeGeneration();
  const controller = new AbortController();
  refreshController = controller;
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  // A refresh with no token to send settles before this function returns; the
  // slot is only taken for one that is actually on the wire.
  let settled = false;
  const promise = (async () => {
    try {
      const state = useAuthStore.getState();
      const refreshToken = state.refreshToken;

      if (!refreshToken) {
        state.logout();
        return null;
      }

      const response = await fetch(getApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      // Whoever asked has signed out since: neither the new tokens nor a
      // failure are this session's to act on.
      if (issuedAt !== currentScopeGeneration()) return null;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          state.logout();
        }
        return null;
      }

      const body = await response.json();
      if (issuedAt !== currentScopeGeneration()) return null;
      if (body.success && body.data?.accessToken) {
        state.setAuthToken(body.data.accessToken);
        if (body.data.refreshToken) {
          state.setRefreshToken(body.data.refreshToken);
        }
        return body.data.accessToken;
      }

      state.logout();
      return null;
    } catch (err) {
      // Do not log out on network errors to prevent unintentional session termination
      return null;
    } finally {
      clearTimeout(timeoutId);
      settled = true;
      // Only this attempt's own slot: a reset may already have started another.
      if (refreshController === controller) {
        refreshController = null;
        refreshPromise = null;
      }
    }
  })();
  if (!settled) refreshPromise = promise;
  return promise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body,
    skipJson,
    headers: customHeaders,
    timeoutMs = 45000,
    signal: externalSignal,
    ...rest
  } = options;
  const token = useAuthStore.getState().authToken;

  const headers = new Headers(customHeaders);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (typeof body === 'string') {
    requestBody = body;
    // A caller that stringified its own JSON still needs the header, or the
    // server's JSON parser skips the body and every field arrives undefined —
    // which is how a correct MPIN was refused for a whole day.
    if (!headers.has('Content-Type') && /^\s*[[{]/.test(body)) {
      headers.set('Content-Type', 'application/json');
    }
  } else if (body != null) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const url = getApiUrl(path);
  const method = (rest.method ?? 'GET').toUpperCase();
  // Keyed by the account as well as the URL: a 304 must never hand one
  // account the body another one fetched. The generation says whether that
  // account is still the one signed in when the response lands.
  const cacheKey = `${method}:${url}@${currentUserScope()}`;
  const issuedAt = currentScopeGeneration();

  if (method === 'GET') {
    // Prevent stale 304-only responses in RN fetch and keep credit/subscription overviews fresh.
    headers.set('Cache-Control', 'no-cache, no-store, max-age=0');
    headers.set('Pragma', 'no-cache');
  }
  const safeHeaders = Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) =>
      key.toLowerCase() === 'authorization' ? [key, 'Bearer ***'] : [key, value],
    ),
  );
  const loggedBody = toLoggableBody(requestBody, headers.get('Content-Type'));
  console.log('[API] Request', {
    baseUrl: API_BASE_URL,
    url,
    method: rest.method ?? 'GET',
    headers: safeHeaders,
    body: loggedBody ?? null,
  });

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const unlinkAbort = linkAbortSignal(controller, externalSignal);

  const startedAt = Date.now();
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body: requestBody,
      signal: controller.signal,
    });
    // Responses were previously never logged, so a failing or slow call looked
    // like "nothing happened" with no way to diagnose it from the device.
    console.log('[API] Response', {
      url,
      status: response.status,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    const ms = Date.now() - startedAt;
    if ((error as Error)?.name === 'AbortError') {
      if (externalSignal?.aborted) {
        console.log('[API] Aborted', { url, ms });
        throw new ApiError(REQUEST_ABORTED_MESSAGE);
      }
      console.error('[API] Timeout', { url, ms });
      throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    console.error('[API] Network error', { url, ms, message: (error as Error)?.message });
    throw new ApiError(getNetworkErrorMessage());
  } finally {
    clearTimeout(timeoutId);
    unlinkAbort();
  }

  if (!response.ok) {
    if (response.status === 304 && method === 'GET') {
      const cached = getResponseCache.get(cacheKey);
      if (cached !== undefined) {
        return cached as T;
      }
    }

    let errorBody: unknown;
    const responseClone = response.clone();
    try {
      errorBody = await response.json();
    } catch {
      try {
        errorBody = await responseClone.text();
      } catch {
        errorBody = null;
      }
    }
    // A 401 for the previous account is not refreshed or retried as the
    // next one: the request simply fails.
    if (
      response.status === 401 &&
      issuedAt === currentScopeGeneration() &&
      !path.includes('/auth/login') &&
      !path.includes('/auth/refresh')
    ) {
      const newAccessToken = await handleTokenRefresh();
      if (newAccessToken && issuedAt === currentScopeGeneration()) {
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        try {
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => {
            retryController.abort();
          }, timeoutMs);
          const unlinkRetryAbort = linkAbortSignal(retryController, externalSignal);

          try {
            response = await fetch(url, {
              ...rest,
              headers,
              body: requestBody,
              signal: retryController.signal,
            });
          } finally {
            clearTimeout(retryTimeoutId);
            unlinkRetryAbort();
          }

          if (response.ok) {
            if (skipJson || response.status === 204) return undefined as T;
            const parsed = (await response.json()) as T;
            if (method === 'GET' && issuedAt === currentScopeGeneration()) {
              getResponseCache.set(cacheKey, parsed as unknown);
            }
            return parsed;
          }
        } catch (error) {
          if ((error as Error)?.name === 'AbortError') {
            if (externalSignal?.aborted) {
              throw new ApiError(REQUEST_ABORTED_MESSAGE);
            }
            throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
          }
          throw new ApiError(getNetworkErrorMessage());
        }
      }
    }

    const message =
      typeof errorBody === 'object' && errorBody !== null
        ? typeof (errorBody as { message?: unknown }).message === 'string'
          ? (errorBody as { message: string }).message
          : typeof (errorBody as { error?: unknown }).error === 'string'
            ? (errorBody as { error: string }).error
            : `Request failed (${response.status})`
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, errorBody);
  }

  if (skipJson || response.status === 204) {
    return undefined as T;
  }

  const parsed = (await response.json()) as T;
  if (method === 'GET' && issuedAt === currentScopeGeneration()) {
    getResponseCache.set(cacheKey, parsed as unknown);
  }
  return parsed;
}
