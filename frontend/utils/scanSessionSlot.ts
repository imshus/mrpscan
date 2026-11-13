/**
 * The scan session the capture screen opens ahead of time, as plain logic
 * with no imports so node can load this very file in a test
 * (utils/__tests__/captureFlow.test.mjs).
 *
 * The session is opened as soon as the capture screen is in front, so it is
 * in hand before the first photo is: the side uploads can leave the moment a
 * photo is cut, and Calculate has nothing to wait for. One session per
 * jewellery type and account: coming back to the screen reuses the one
 * already open instead of opening another. One the shop walks away from is
 * harmless — the server lets it expire.
 *
 * A session that has had a photo sent to it keeps that photo on the server,
 * and a later scan on it would be read with it. So once that photo's side is
 * dropped (discarded, or a retake whose cut failed) such a session is let go
 * and a clean one opened; a session holding none of the dropped sides is kept.
 */

type Held<T, K> = {
  type: K;
  scope: number;
  promise: Promise<T>;
  /** The sides a photo was sent to this session for. */
  sent: Set<string>;
};

export type ScanSessionSlot<T, K extends string = string> = ReturnType<typeof createScanSessionSlot<T, K>>;

export function createScanSessionSlot<T, K extends string = string>(open: (type: K) => Promise<T>) {
  let held: Held<T, K> | null = null;

  const usable = (type: K, scope: number): Held<T, K> | null =>
    held && held.type === type && held.scope === scope ? held : null;

  const ensure = (type: K, scope: number): Held<T, K> => {
    const existing = usable(type, scope);
    if (existing) return existing;
    const entry: Held<T, K> = { type, scope, promise: open(type), sent: new Set() };
    held = entry;
    // A session that failed to open is forgotten, so the next ask retries.
    entry.promise.catch(() => {
      if (held === entry) held = null;
    });
    return entry;
  };

  return {
    /**
     * The session for this jewellery type and account, opened now unless one
     * is already open (or opening). Never opens a second for the same pair.
     */
    ensure(type: K, scope: number): Promise<T> {
      return ensure(type, scope).promise;
    },

    /** As `ensure`, for a photo of `side` about to be sent to the session. */
    claimForUpload(type: K, scope: number, side: string): Promise<T> {
      const entry = ensure(type, scope);
      entry.sent.add(side);
      return entry.promise;
    },

    /** The scan has taken this session over: the slot is empty again. */
    release(promise: Promise<T>): void {
      if (held?.promise === promise) held = null;
    },

    /**
     * Photos were dropped — every side (a discard), or just `side` (a cut
     * that failed). A session a dropped side's photo may already sit in is
     * let go (true); one that holds none is kept for the next photo (false).
     */
    releaseIfUsed(side?: string): boolean {
      if (!held) return false;
      const holdsDropped = side === undefined ? held.sent.size > 0 : held.sent.has(side);
      if (!holdsDropped) return false;
      held = null;
      return true;
    },

    /** Whether a session is held for this pair right now (tests, logging). */
    holds(type: K, scope: number): boolean {
      return usable(type, scope) !== null;
    },
  };
}
