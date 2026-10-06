import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { create } from 'zustand';

import {
  BHAW_LIVE_STREAM_URL,
  BHAW_PROVIDERS,
  feedMcxSell,
  fetchBhawVendors,
  parseBhawPayload,
  selectVendor,
  type BhawProvider,
  type BhawVendor,
} from '@/utils/bhawApi';
import { registerScopeResetCallback, scopedKey } from '@/utils/userScopedStorage';
import { calculateBhawRates, type BhawRates } from '@/utils/bhawCalculation';
import { openEventStream } from '@/utils/sseClient';

/**
 * Live bhaw feed shared across screens.
 *
 * Home, Gold Rate Settings and Dashboard Settings all read from here, so the
 * selected provider and the rates derived from it can never disagree between
 * screens. The selected provider itself is owned by the Dashboard Settings
 * toggle (matricesStore `bhaw_source_jmd`) and pushed in via setProvider.
 *
 * The boards come off the live stream (BHAW_LIVE_STREAM_URL) over ONE
 * connection shared by every mounted screen: opened when the first screen
 * subscribes, closed when the last one leaves or the app goes to the
 * background, reopened when it comes back. The stream sends ~5 snapshots a
 * second; the store takes at most one a second, and only when a board
 * actually moved, so Home does not re-render on every tick.
 */

/** Which house this account follows, remembered across cold starts. */
const PROVIDER_KEY = 'bullion-provider';

interface BhawState {
  provider: string;
  vendors: BhawVendor[];
  /** True once the feed has answered — a snapshot, or an error. */
  isLoaded: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;

  setProvider: (provider: string) => void;
  /** Reads the remembered house once, before the first paint that shows it. */
  hydrateProvider: () => Promise<void>;
  /** The board's own "Gold Future MCX" sell, or null while the feed is out. */
  mcxSell: () => number | null;
  /** One look at the stream, outside the shared connection (de-duped). */
  refresh: () => Promise<void>;
  /**
   * Keeps the shared live connection open while a screen is mounted;
   * returns the unsubscribe. (Named for the 30 s poll it replaced.)
   */
  startPolling: () => () => void;

  selectedVendor: () => BhawVendor | null;
  ratesFor: (input: {
    mcxBaseRate: number;
    businessCashChange?: number;
    businessRtgsChange?: number;
    fallbackCashBhaw?: number;
    fallbackRtgsBhaw?: number;
  }) => BhawRates;
}

/** At most one store write a second; the latest snapshot in that second wins. */
const WRITE_THROTTLE_MS = 1_000;
/** The stream pings at least every 20 s; silence that long is a dead line. */
const WATCHDOG_MS = 20_000;
/** Reconnects wait 1, 2, 4, 8 s… capped here; a snapshot resets the count. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

const NO_PROVIDERS = 'Bhaw feed returned no providers';

// Module-level so concurrent screens share one connection, one set of
// timers and one in-flight one-shot request.
let subscribers = 0;
let inFlight: Promise<void> | null = null;
let closeStream: (() => void) | null = null;
/** Bumped per connection, so a dropped connection's late callbacks are ignored. */
let connectionId = 0;
let appStateSubscription: NativeEventSubscription | null = null;
let inForeground = true;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let lastWriteAt = 0;
let pendingVendors: BhawVendor[] | null = null;
/** The boards the store last wrote, as boardsSignature reads them. */
let lastSignature = '';

export const useBhawStore = create<BhawState>()((set, get) => ({
  // Empty until the remembered choice is read (or the legacy toggle answers
  // for accounts that never picked): a hardcoded default here would shadow
  // both for the first paint.
  provider: '',
  vendors: [],
  isLoaded: false,
  isRefreshing: false,
  error: null,
  lastUpdatedAt: null,

  setProvider: (provider) => {
    if (get().provider === provider) return;
    set({ provider });
    // Per account: a shared phone must not follow one shop's house for another.
    AsyncStorage.setItem(scopedKey(PROVIDER_KEY), provider).catch(() => {});
  },

  hydrateProvider: async () => {
    try {
      const stored = await AsyncStorage.getItem(scopedKey(PROVIDER_KEY));
      if (stored) set({ provider: stored });
    } catch {
      // The default provider is a working answer; a failed read is not news.
    }
  },

  mcxSell: () => feedMcxSell(get().vendors),

  refresh: async () => {
    if (inFlight) return inFlight;
    set({ isRefreshing: true });
    inFlight = (async () => {
      try {
        applyVendors(await fetchBhawVendors());
      } catch (err) {
        reportError(err);
      } finally {
        set({ isRefreshing: false });
        inFlight = null;
      }
    })();
    return inFlight;
  },

  startPolling: () => {
    subscribers += 1;
    if (subscribers === 1) {
      // Nothing listened while no screen did; read where the app is now.
      inForeground = isForeground(AppState.currentState);
      appStateSubscription?.remove();
      appStateSubscription = AppState.addEventListener('change', onAppStateChange);
      reconnectAttempt = 0;
      connect();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0) {
        appStateSubscription?.remove();
        appStateSubscription = null;
        disconnect();
      }
    };
  },

  selectedVendor: () => selectVendor(get().vendors, get().provider),

  ratesFor: ({
    mcxBaseRate,
    businessCashChange = 0,
    businessRtgsChange = 0,
    fallbackCashBhaw = 0,
    fallbackRtgsBhaw = 0,
  }) =>
    calculateBhawRates({
      mcxBaseRate,
      vendor: get().selectedVendor(),
      businessCashChange,
      businessRtgsChange,
      fallbackCashBhaw,
      fallbackRtgsBhaw,
    }),
}));

/**
 * What a write would change on screen: each house's key, board lines and
 * bhaw. The feed's timestamp moves on every tick and is left out, so a
 * snapshot that only re-dates the same boards is not written.
 */
function boardsSignature(vendors: BhawVendor[]): string {
  return JSON.stringify(
    vendors.map((v) => [v.source, v.rows.map((r) => [r.label, r.buy, r.sell]), v.cashBhaw, v.rtgsBhaw]),
  );
}

/** Writes one snapshot; an empty one keeps the boards already shown. */
function applyVendors(vendors: BhawVendor[]): void {
  const state = useBhawStore.getState();
  if (vendors.length === 0) {
    if (state.error !== NO_PROVIDERS || !state.isLoaded) {
      useBhawStore.setState({ error: NO_PROVIDERS, isLoaded: true });
    }
    return;
  }
  const signature = boardsSignature(vendors);
  if (signature === lastSignature && state.isLoaded && state.error === null) return;
  lastSignature = signature;
  useBhawStore.setState({
    vendors,
    error: null,
    isLoaded: true,
    lastUpdatedAt: vendors[0]?.updatedAt || null,
  });
}

/** An error keeps the last boards on screen and records why they stopped. */
function reportError(err: unknown): void {
  const message = err instanceof Error ? err.message : 'Could not load bhaw rates';
  const state = useBhawStore.getState();
  if (state.error !== message || !state.isLoaded) {
    useBhawStore.setState({ error: message, isLoaded: true });
  }
}

function flushPendingWrite(): void {
  writeTimer = null;
  const vendors = pendingVendors;
  pendingVendors = null;
  if (!vendors) return;
  lastWriteAt = Date.now();
  applyVendors(vendors);
}

/** Throttled write: at most one a second, the latest snapshot winning. */
function queueWrite(vendors: BhawVendor[]): void {
  pendingVendors = vendors;
  if (writeTimer) return;
  const wait = lastWriteAt + WRITE_THROTTLE_MS - Date.now();
  if (wait <= 0) flushPendingWrite();
  else writeTimer = setTimeout(flushPendingWrite, wait);
}

function clearWatchdog(): void {
  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = null;
}

/** Restarted by everything received; if it fires, the line has gone quiet. */
function armWatchdog(id: number): void {
  clearWatchdog();
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    if (id !== connectionId) return;
    dropConnection();
    reportError(new Error('Live rates stream went quiet'));
    scheduleReconnect();
  }, WATCHDOG_MS);
}

function dropConnection(): void {
  connectionId += 1;
  clearWatchdog();
  const close = closeStream;
  closeStream = null;
  close?.();
}

function connect(): void {
  if (closeStream || subscribers === 0 || !inForeground) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;

  connectionId += 1;
  const id = connectionId;
  armWatchdog(id);
  closeStream = openEventStream(BHAW_LIVE_STREAM_URL, {
    onActivity: () => {
      if (id === connectionId) armWatchdog(id);
    },
    onMessage: (data) => {
      if (id !== connectionId) return;
      // Heartbeat events never get here; anything else that is not a
      // snapshot's shape is ignored rather than read as rates.
      const vendors = parseBhawPayload(data);
      if (vendors === null) return;
      reconnectAttempt = 0;
      queueWrite(vendors);
    },
    onError: (error) => {
      if (id !== connectionId) return;
      dropConnection();
      reportError(error);
      scheduleReconnect();
    },
  });
}

/** Closes the connection and any pending reconnect; the boards stay. */
function disconnect(): void {
  dropConnection();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect(): void {
  if (reconnectTimer || subscribers === 0 || !inForeground) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

/** 'unknown' (or no answer yet, early on iOS) counts as on screen. */
function isForeground(status: AppStateStatus | null | undefined): boolean {
  return status !== 'background' && status !== 'inactive';
}

/** No stream while the app is in the background; back on when it returns. */
function onAppStateChange(next: AppStateStatus): void {
  if (next === 'active') {
    inForeground = true;
    if (subscribers > 0 && !closeStream) {
      reconnectAttempt = 0;
      connect();
    }
  } else if (next === 'background' || next === 'inactive') {
    inForeground = false;
    disconnect();
  }
}

// Another account on this phone follows its own house: the last one's
// choice must not stand in for it until its own has been read.
registerScopeResetCallback(() => {
  useBhawStore.setState({ provider: '' });
});

/** Maps the Dashboard Settings toggle onto a provider key. */
export function providerFromToggle(useJmd: boolean): BhawProvider {
  return useJmd ? BHAW_PROVIDERS.JMD_PATIL : BHAW_PROVIDERS.MEGA_BULLION;
}
