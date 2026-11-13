/**
 * The capture screen's two sides, as plain logic with no imports, so node
 * can load this very file in a test (utils/__tests__/captureFlow.test.mjs).
 *
 * A side is held the moment the camera hands its photo back: the screen moves
 * on while the photo is still being cut to the frame. Everything that needs
 * the cut file — the thumbnail, the upload, Calculate — waits on that side's
 * own `file`. A cut that fails drops the side again, so it can be retaken.
 *
 * The shutter is held from the press until the camera has answered, so one
 * press is one photo: a second tap in that moment is ignored, not queued.
 */

export type CaptureSide = 'front' | 'back';
export type CaptureStep = 'first' | 'second';

export type SideCapture<S> = {
  /** One per photo: tells a side from the one that replaced it. */
  id: number;
  side: CaptureSide;
  source: S;
  /** The side's file once it is ready; null while it is still being cut. */
  uri: string | null;
  /** Settles with the file, or rejects when it could not be made. */
  file: Promise<string>;
};

export type CaptureFlowState<S> = {
  step: CaptureStep;
  front: SideCapture<S> | null;
  back: SideCapture<S> | null;
  /** A shutter press whose photo has not come back yet. */
  shutterBusy: boolean;
};

/** One shutter press: which side it is for, and which scan it belongs to. */
export type ShutterTicket = { side: CaptureSide; generation: number };

/** What Calculate starts the scan with: both files cut and in hand. */
export type ReadySides<S> = { front: string; back: string | null; source: S };

export type CaptureFlowHandlers<S> = {
  /** A side's file is ready (cut, or swapped for a better one): send it up. */
  onReady?: (capture: SideCapture<S>) => void;
  /** A side's file could not be made; the side has already been dropped. */
  onFailed?: (capture: SideCapture<S>, error: unknown) => void;
};

export type CaptureFlow<S> = ReturnType<typeof createCaptureFlow<S>>;

export function createCaptureFlow<S>(handlers: CaptureFlowHandlers<S> = {}) {
  let state: CaptureFlowState<S> = { step: 'first', front: null, back: null, shutterBusy: false };
  // Bumped whenever the sides are dropped: a photo or a cut still on its way
  // for a scan the shop has since discarded cannot land in the next one.
  let generation = 0;
  let nextId = 1;
  // Counts cuts that failed while their side was still held, so Calculate
  // can tell "a side failed while I waited" from "a side was replaced".
  let failures = 0;
  let shutter: { ticket: ShutterTicket; done: Promise<void>; finish: () => void } | null = null;
  const listeners = new Set<(next: CaptureFlowState<S>) => void>();

  const set = (patch: Partial<CaptureFlowState<S>>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };

  const isCurrent = (capture: SideCapture<S>): boolean => state[capture.side]?.id === capture.id;

  const hold = (capture: SideCapture<S>) => {
    if (capture.side === 'front') set({ front: capture, back: null, step: 'second' });
    else set({ back: capture });
  };

  /** The same side, its record changed (its file landed, or was swapped). */
  const update = (capture: SideCapture<S>) => {
    if (capture.side === 'front') set({ front: capture });
    else set({ back: capture });
  };

  const drop = (side: CaptureSide) => {
    // A front that could not be made takes the scan back to its start: the
    // back was taken as the second side of that front.
    if (side === 'front') set({ front: null, back: null, step: 'first' });
    else set({ back: null });
  };

  return {
    getState: (): CaptureFlowState<S> => state,

    subscribe(listener: (next: CaptureFlowState<S>) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    isCurrent,

    /**
     * Holds the shutter for one press. Null while a press is still waiting
     * for its photo — the tap is ignored, so there is never a double capture.
     */
    beginShutter(): ShutterTicket | null {
      if (shutter) return null;
      const ticket: ShutterTicket = {
        side: state.step === 'second' ? 'back' : 'front',
        generation,
      };
      let finish: () => void = () => undefined;
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      shutter = { ticket, done, finish };
      set({ shutterBusy: true });
      return ticket;
    },

    /** The press has its answer (a photo, or none): the shutter is free again. */
    endShutter(ticket: ShutterTicket): void {
      if (!shutter || shutter.ticket !== ticket) return;
      const { finish } = shutter;
      shutter = null;
      set({ shutterBusy: false });
      finish();
    },

    /**
     * Holds a side now, with its file still on its way when `file` is a
     * promise. The front moves the screen on to the back; the back stays.
     * Refused (null) for a press whose scan was discarded in the meantime, or
     * for a back with no front.
     */
    confirm(
      side: CaptureSide,
      source: S,
      file: Promise<string> | string,
      ticket?: ShutterTicket,
    ): SideCapture<S> | null {
      if (ticket && ticket.generation !== generation) return null;
      if (side === 'back' && !state.front) return null;
      const known = typeof file === 'string';
      const capture: SideCapture<S> = {
        id: nextId++,
        side,
        source,
        uri: known ? file : null,
        file: known ? Promise.resolve(file) : file,
      };
      hold(capture);
      capture.file.then(
        (uri) => {
          if (!isCurrent(capture)) return;
          const held = state[side];
          const ready = held && held.uri === uri ? held : { ...capture, uri };
          if (ready !== held) update(ready);
          handlers.onReady?.(ready);
        },
        (error: unknown) => {
          if (!isCurrent(capture)) return;
          failures += 1;
          drop(side);
          handlers.onFailed?.(capture, error);
        },
      );
      return capture;
    },

    /**
     * Swaps a held side's file for a better one (the tag finder's cut of a
     * gallery photo). Null when that side has since been replaced or dropped.
     */
    swap(capture: SideCapture<S>, uri: string): SideCapture<S> | null {
      if (!isCurrent(capture)) return null;
      const next: SideCapture<S> = { ...capture, id: nextId++, uri, file: Promise.resolve(uri) };
      update(next);
      handlers.onReady?.(next);
      return next;
    },

    /** Drops both sides; anything still on its way for them is ignored. */
    discard(): void {
      generation += 1;
      set({ front: null, back: null, step: 'first' });
    },

    /**
     * For Calculate: waits for a press still waiting on its photo, then for
     * both held sides' files. Null when there is no front, or a side failed
     * (and was dropped) while waiting; a side replaced meanwhile is waited
     * for in its place.
     */
    async whenReady(): Promise<ReadySides<S> | null> {
      for (;;) {
        if (shutter) await shutter.done;
        const { front, back } = state;
        if (!front) return null;
        const failuresBefore = failures;
        let uris: [string, string | null] | null;
        try {
          uris = await Promise.all([front.file, back ? back.file : Promise.resolve(null)]);
        } catch {
          uris = null;
        }
        if (failures !== failuresBefore) return null;
        const unchanged =
          !shutter &&
          state.front?.id === front.id &&
          (state.back?.id ?? null) === (back?.id ?? null);
        if (unchanged) {
          if (!uris) return null;
          return { front: uris[0], back: uris[1], source: (back ?? front).source };
        }
      }
    },
  };
}
