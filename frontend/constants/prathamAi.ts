/**
 * Pratham AI — the voice agent behind the bottom bar's third tab. The app
 * speaks to the Dynamic Voice Agent server directly over its WebSocket, the
 * way that server's own web page does: 16 kHz PCM up, 24 kHz PCM down.
 */

/** Build-time address of the agent server; the server's PRATHAM_AI_URL overrides it. */
export const PRATHAM_AI_URL_FALLBACK = (process.env.EXPO_PUBLIC_PRATHAM_AI_URL ?? '').trim();

/** The call ends on its own after this long without the caller saying anything. */
export const PRATHAM_AI_SILENCE_MS = 10000;

/** How long to let the agent say goodbye after the caller asks to end the call. */
export const PRATHAM_AI_FAREWELL_MS = 6000;

/** Sample rate the agent server listens at (Deepgram Flux). */
export const PRATHAM_AI_MIC_RATE = 16000;

/**
 * Ways a caller says the call is over, in English, Hinglish and Hindi:
 * "okay cut the call", "call end karo", "bye". Matched against each final
 * transcript of the caller's turn.
 */
export const END_CALL_PATTERNS: RegExp[] = [
  /\b(cut|end|hang\s*up|disconnect|finish|close|stop|drop)\b[^.?!]{0,24}\bcall\b/i,
  /\bcall\b[^.?!]{0,24}\b(cut|end|band|khatam|khatm|kat|katdo|rakh)\b/i,
  /\b(bye|goodbye|bye-?bye|tata|ta-ta)\b/i,
  /कॉल\s*(कट|बंद|खत्म|काट|रख)/,
  /(बाय|अलविदा)/,
];

export function saysEndCall(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return END_CALL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * The agent's WebSocket address for a hosted base URL: http(s) becomes
 * ws(s), a bare host gets wss, and the "/ws" path is added when missing.
 */
export function toAgentWsUrl(base: string): string | null {
  const trimmed = base.trim();
  if (!trimmed) return null;
  let url = trimmed.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  if (!/^wss?:\/\//i.test(url)) url = `wss://${url}`;
  url = url.replace(/\/+$/, '');
  if (!/\/ws$/i.test(url)) url = `${url}/ws`;
  return url;
}
