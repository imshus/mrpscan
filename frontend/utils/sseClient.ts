import { fetch as streamingFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { createSseFrameParser, isSnapshotEvent } from './sseFrames';

/**
 * A Server-Sent Events reader over a streaming fetch.
 *
 * React Native's global fetch hands over the body only once it has ended,
 * and an event stream never ends, so this uses expo/fetch, whose body is a
 * ReadableStream on Android and iOS. On web expo/fetch is the browser's own
 * fetch, which streams too. XMLHttpRequest-based SSE libraries are out: RN's
 * XHR keeps the whole body in memory for as long as the stream is open.
 *
 * One call is one connection. It is not reopened here when it fails or
 * ends — the caller owns reconnecting (see store/bhawStore.ts).
 */

/**
 * A browser sends Cache-Control only after a CORS preflight, and the rate
 * stream's preflight answer does not allow that header (checked 6 Oct 2026),
 * so the web build asks with Accept alone; browsers do not cache an event
 * stream anyway.
 */
const STREAM_HEADERS: Record<string, string> =
  Platform.OS === 'web'
    ? { Accept: 'text/event-stream' }
    : { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' };

export interface EventStreamHandlers {
  /** The data of each snapshot event (unnamed or "message"), as sent. */
  onMessage: (data: string) => void;
  /** Anything arrived — a snapshot, a heartbeat, a ": ping" comment. */
  onActivity?: () => void;
  /** The connection failed, was refused, or ended. Nothing follows it. */
  onError?: (error: Error) => void;
}

/** Opens the stream; returns close(). After close() no handler is called. */
export function openEventStream(url: string, handlers: EventStreamHandlers): () => void {
  const controller = new AbortController();
  const parser = createSseFrameParser();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let closed = false;

  // Abort ends the request; cancel releases a read that is still waiting,
  // in case the abort alone does not settle it.
  const stop = () => {
    controller.abort();
    reader?.cancel().catch(() => {});
  };

  const fail = (error: unknown) => {
    if (closed) return;
    closed = true;
    stop();
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  (async () => {
    const response = await streamingFetch(url, {
      signal: controller.signal,
      headers: STREAM_HEADERS,
    });
    if (!response.ok) throw new Error(`Live rates stream returned ${response.status}`);
    const body = response.body;
    if (!body) throw new Error('Live rates stream has no body');

    const streamReader = body.getReader();
    reader = streamReader;
    if (closed) {
      stop();
      return;
    }
    const decoder = new TextDecoder();
    while (!closed) {
      const { done, value } = await streamReader.read();
      if (closed) return;
      if (done) throw new Error('Live rates stream ended');
      if (!value || value.length === 0) continue;
      handlers.onActivity?.();
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (closed) return;
        if (isSnapshotEvent(event)) handlers.onMessage(event.data);
      }
    }
  })().catch(fail);

  return () => {
    if (closed) return;
    closed = true;
    stop();
  };
}
