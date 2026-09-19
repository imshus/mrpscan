import { ApiError } from '@/utils/apiClient';

/**
 * Sentences for the codes the API throws as messages.
 *
 * Several middlewares raise `new Error('SOME_CODE')`, and the error handler
 * forwards that message, so the code itself reaches the screen — a shop is
 * shown PERMANENT_LICENSE_REQUIRED and left to guess. These are the same
 * refusals said in words, without pretending the refusal did not happen.
 */
const MESSAGES: Record<string, string> = {
  PERMANENT_LICENSE_REQUIRED: 'This needs lifetime access. Buy the licence to continue.',
  LICENSE_REQUIRED: 'Your licence is not active. Start the free trial or buy lifetime access to continue.',
  LICENSE_CONTEXT_MISSING: 'Your licence could not be read just now. Please try again.',
  TRIAL_ALREADY_EXPIRED: 'This shop has already used its free trial.',
  TRIAL_ALREADY_ACTIVE: 'The free trial is already running.',
  LICENSE_ALREADY_PERMANENT: 'This shop already owns lifetime access.',
  RATE_LIMIT_EXCEEDED: 'Too many attempts just now. Please try again a little later.',
  MPIN_NOT_SET: 'This account has no MPIN yet. Set one to sign in.',
  INVALID_CREDIT_AMOUNT: 'That credit amount is not valid.',
  UNAUTHORIZED: 'Please sign in again.',
};

/** True for a message that is a bare code rather than a sentence. */
function looksLikeCode(text: string): boolean {
  return /^[A-Z][A-Z0-9_]{3,}$/.test(text.trim());
}

/**
 * Sentences for the failures that never reach the error handler at all.
 *
 * A 404 on an endpoint the app knows how to call does not mean the shop did
 * anything wrong: it means the server it is talking to is older than the app.
 * "Request failed (404)" tells a jeweller nothing and reads like their fault.
 */
const STATUS_MESSAGES: Record<number, string> = {
  404: 'This is not available on the server yet. It will work once the app is updated on our side.',
  502: 'The server is not reachable just now. Please try again in a moment.',
  503: 'The server is busy just now. Please try again in a moment.',
  504: 'The server took too long to answer. Please try again.',
};

/**
 * What to show a shop for a failed request: the mapped sentence for a known
 * code, the server's own message when it wrote one, and the caller's fallback
 * when all that came back was an unrecognised code.
 */
export function friendlyServerMessage(error: unknown, fallback: string): string {
  const raw = error instanceof ApiError || error instanceof Error ? error.message.trim() : '';

  // The status first: an endpoint the server does not have answers with its
  // own generic text, which would otherwise be shown verbatim.
  if (error instanceof ApiError && error.status && STATUS_MESSAGES[error.status]) {
    return STATUS_MESSAGES[error.status];
  }

  if (!raw) return fallback;

  const mapped = MESSAGES[raw];
  if (mapped) return mapped;

  // An unknown code is worse than nothing: it tells the shop it is their
  // fault and gives them no way to act.
  return looksLikeCode(raw) ? fallback : raw;
}
