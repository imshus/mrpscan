/**
 * Choose a Bullion: where the tick sits while saves are on their way.
 *
 * The phone follows a tapped house at once and the server records it behind
 * (POST /settings/bullion). The screen's own GET, a tap's save and a later
 * tap's save can answer in any order; these decide what each answer does
 * to the tick, so the tick ends on the house the server prices on:
 *
 *   - a GET that answers after a tap is older than the tap: it never moves
 *     the tick back;
 *   - a save's answer moves the tick to the house the server saved;
 *   - a failed latest tap goes back to the last house the server confirmed
 *     (its GET, or any save it answered), not to the house shown before
 *     that tap, which may itself have been an unsaved tap.
 *
 * No imports on purpose: node loads this file as-is (type stripping) for
 * utils/__tests__/bullionChoice.test.mjs.
 */

export interface BullionChoice {
  /** The house the server last confirmed (its GET, or a save); '' until it has. */
  confirmed: string;
  /** Which answer confirmed it: 0 the GET, n the nth tap's save. */
  confirmedBy: number;
  /** Taps on this screen so far; the latest is the one whose answer counts. */
  taps: number;
  /** The latest tap's save has answered, and failed. */
  latestFailed: boolean;
  /** The house the phone showed before the first tap: the way back while nothing is confirmed. */
  beforeTaps: string;
}

export function initialBullionChoice(): BullionChoice {
  return { confirmed: '', confirmedBy: 0, taps: 0, latestFailed: false, beforeTaps: '' };
}

/**
 * The screen's GET answered with `selected`. `follow` is the house the tick
 * goes to, or null to leave it: once a tap has been made the GET is older
 * than it, unless that tap failed with no save confirmed since.
 */
export function choiceOnLoaded(
  choice: BullionChoice,
  selected: string,
): { choice: BullionChoice; follow: string | null } {
  if (!selected || choice.confirmedBy > 0) return { choice, follow: null };
  const next = { ...choice, confirmed: selected };
  return { choice: next, follow: choice.taps === 0 || choice.latestFailed ? selected : null };
}

/** A tap, with the phone showing `showing` just before it. */
export function choiceOnTap(
  choice: BullionChoice,
  showing: string,
): { choice: BullionChoice; attempt: number } {
  const attempt = choice.taps + 1;
  return {
    choice: {
      ...choice,
      taps: attempt,
      latestFailed: false,
      beforeTaps: choice.taps === 0 ? showing : choice.beforeTaps,
    },
    attempt,
  };
}

/**
 * Save `attempt` answered: the server now prices on `selected`. `follow` is
 * the house the tick goes to — the latest tap's own answer, or an earlier
 * one landing after the latest failed — else null (a later tap is still on
 * its way and settles the tick itself).
 */
export function choiceOnSaved(
  choice: BullionChoice,
  attempt: number,
  selected: string,
): { choice: BullionChoice; follow: string | null } {
  // An older save's late answer: a newer one has already been confirmed.
  if (!selected || attempt < choice.confirmedBy) return { choice, follow: null };
  const next = { ...choice, confirmed: selected, confirmedBy: attempt };
  const follow = attempt === choice.taps || choice.latestFailed ? selected : null;
  return { choice: next, follow };
}

/**
 * Save `attempt` failed. `revertTo` is the house the tick goes back to — the
 * last one the server confirmed, else the one shown before the first tap —
 * or null when a later tap is on its way (its answer settles things).
 */
export function choiceOnFailed(
  choice: BullionChoice,
  attempt: number,
): { choice: BullionChoice; revertTo: string | null } {
  if (attempt !== choice.taps) return { choice, revertTo: null };
  return {
    choice: { ...choice, latestFailed: true },
    revertTo: choice.confirmed || choice.beforeTaps,
  };
}

/** The house a shop follows until it chooses another, at the shop's asking. */
export const DEFAULT_HOUSE = 'jmd_patil';

/**
 * The house the phone follows, between the one it remembers ('' for none)
 * and the one the server prices this account on (gold rates'
 * bhawSource.key): undefined until the server has answered, null or '' when
 * it answered naming none.
 *
 * The server's house wins as soon as it has answered. A remembered house
 * once stood in front of it for good, and older builds remembered the
 * two-house toggle's answer — Mega Bullion for every shop that had not
 * touched it while the toggle defaulted to off. Until the server answers
 * the remembered house stands in, and nothing ('') while there is none: a
 * made-up house would only flash. A server that names no house leaves the
 * default, JMD Patil.
 */
export function phoneHouse(remembered: string, server: string | null | undefined): string {
  if (server) return server;
  if (server === undefined) return remembered;
  return remembered || DEFAULT_HOUSE;
}

/**
 * The save's body for a tap on `key`. The shop's requested names go only
 * once the list has loaded: unknown, they are left out and the server keeps
 * the ones it has (an empty list would have wiped them).
 */
export function bullionSaveBody(
  key: string,
  requestedNames: readonly string[] | null | undefined,
): { selected: string; requestedNames?: string[] } {
  return requestedNames ? { selected: key, requestedNames: [...requestedNames] } : { selected: key };
}

/** A tap's save waiting to go: its house and its tap number. */
export interface BullionSaveJob {
  key: string;
  attempt: number;
}

/**
 * Saves go to the server one at a time, in tap order: a save for a house
 * just added on the tracker is checked against the feed and answers slower,
 * so a quicker save for a later tap could land first and the server would
 * end on the older house while the tick showed the newer one. While a save
 * is out only the latest tap waits; the taps it replaced are never sent.
 */
export interface BullionSaveQueue {
  inFlight: boolean;
  pending: BullionSaveJob | null;
}

export function initialBullionSaveQueue(): BullionSaveQueue {
  return { inFlight: false, pending: null };
}

/** A tap's save: sent now when nothing is out, else held as the one to send next. */
export function queueOnTap(
  queue: BullionSaveQueue,
  job: BullionSaveJob,
): { queue: BullionSaveQueue; send: BullionSaveJob | null } {
  if (!queue.inFlight) return { queue: { inFlight: true, pending: null }, send: job };
  return { queue: { inFlight: true, pending: job }, send: null };
}

/** The save that was out has answered (either way): the held one goes next, if any. */
export function queueOnSettled(
  queue: BullionSaveQueue,
): { queue: BullionSaveQueue; send: BullionSaveJob | null } {
  if (queue.pending) return { queue: { inFlight: true, pending: null }, send: queue.pending };
  return { queue: initialBullionSaveQueue(), send: null };
}
