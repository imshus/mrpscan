/**
 * Server-Sent Events framing, byte-stream agnostic: text goes in as it
 * arrives, whole events come out.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/bhawStream.test.mjs and the stream smoke check, so what is
 * tested is what the app runs.
 *
 * The rules, as the rate feeds frame their events:
 *   - lines split on \n, a trailing \r stripped;
 *   - a blank line dispatches the pending event (only if it has data);
 *   - a line starting with ':' is a comment (": ping") — liveness only;
 *   - "event:" names the event, "data:" lines join with \n, one leading
 *     space after the colon is dropped, other fields (id, retry) ignored;
 *   - only an unnamed event or one named "message" carries a snapshot — a
 *     "heartbeat" event is liveness only and is never read as rates.
 */

export interface SseEvent {
  /** The "event:" name, '' when the frame named none. */
  event: string;
  /** The "data:" lines, joined with \n. */
  data: string;
}

export interface SseFrameParser {
  /** Feeds the next piece of decoded text; returns the events it completed. */
  push(text: string): SseEvent[];
  /** Drops any half-received line or event (a new connection starts clean). */
  reset(): void;
}

export function createSseFrameParser(): SseFrameParser {
  // The tail of the last chunk that has not met its \n yet.
  let partial = '';
  let eventName = '';
  let dataLines: string[] = [];

  const reset = () => {
    partial = '';
    eventName = '';
    dataLines = [];
  };

  const push = (text: string): SseEvent[] => {
    const out: SseEvent[] = [];
    const lines = (partial + text).split('\n');
    partial = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (line === '') {
        if (dataLines.length > 0) out.push({ event: eventName, data: dataLines.join('\n') });
        eventName = '';
        dataLines = [];
        continue;
      }
      if (line.startsWith(':')) continue;

      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') eventName = value;
      else if (field === 'data') dataLines.push(value);
    }
    return out;
  };

  return { push, reset };
}

/** True for the events that carry a snapshot: unnamed, or named "message". */
export function isSnapshotEvent(event: SseEvent): boolean {
  return event.event === '' || event.event === 'message';
}
