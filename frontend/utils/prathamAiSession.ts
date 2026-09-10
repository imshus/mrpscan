import { Alert, Linking, Platform } from 'react-native';
import { create } from 'zustand';

import { PRATHAM_AI_URL_FALLBACK, toAgentWsUrl } from '@/constants/prathamAi';
import { fetchAppConfig } from '@/utils/appConfigApi';
import { PrathamAiCall, type CallStatus } from '@/utils/prathamAiCall';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

/**
 * The one Pratham AI call the app can have running, owned outside the screen
 * tree so the bottom bar's button is the whole interface: tapping it dials
 * the voice agent, tapping it again hangs up, and the icon turns green while
 * the call is live. Walking between screens does not interrupt it.
 */
type SessionStatus = 'idle' | CallStatus;

interface PrathamAiSessionState {
  status: SessionStatus;
  /** A call is being placed or is under way. */
  live: boolean;
}

export const usePrathamAiSession = create<PrathamAiSessionState>(() => ({
  status: 'idle',
  live: false,
}));

const LIVE_STATUSES: SessionStatus[] = ['connecting', 'listening', 'speaking'];

let call: PrathamAiCall | null = null;
let starting = false;
/** Bumped whenever a call ends or a new one is placed, so an attempt that was
 * cancelled while it was still connecting does not go on to open a call. */
let generation = 0;

function setStatus(status: SessionStatus): void {
  usePrathamAiSession.setState({ status, live: LIVE_STATUSES.includes(status) });
}

/** Signing out or switching accounts ends the call. */
registerScopeResetCallback(() => {
  endPrathamAiCall();
});

export function endPrathamAiCall(): void {
  generation += 1;
  const current = call;
  call = null;
  current?.hangUp();
  setStatus('idle');
}

/**
 * The bottom bar's Pratham AI button: places the call, or ends the one in
 * progress. Nothing is navigated to — the call has no page of its own.
 */
export async function togglePrathamAiCall(): Promise<void> {
  if (call || usePrathamAiSession.getState().live) {
    endPrathamAiCall();
    return;
  }
  if (starting) return;

  starting = true;
  const attempt = (generation += 1);
  setStatus('connecting');
  try {
    const config = await fetchAppConfig();
    const base = (config.prathamAiUrl || PRATHAM_AI_URL_FALLBACK).trim();
    // Tapped again while the address was being fetched: the call is off.
    if (generation !== attempt) return;

    if (Platform.OS === 'web') {
      // The web build has no native microphone module; the agent's own page
      // does the call there.
      setStatus('idle');
      if (base) await Linking.openURL(base);
      else notConfigured();
      return;
    }

    const wsUrl = toAgentWsUrl(base);
    if (!wsUrl) {
      setStatus('idle');
      notConfigured();
      return;
    }

    const session = new PrathamAiCall(
      {
        onStatus: (status, detail) => {
          if (call !== session) return;
          if (status === 'error') {
            call = null;
            setStatus('idle');
            if (detail) Alert.alert('Pratham AI', detail);
            return;
          }
          if (status === 'ended') {
            call = null;
            setStatus('idle');
            return;
          }
          setStatus(status);
        },
        // The transcript has no home on this screen-less call; the voice is
        // the whole conversation.
        onTranscript: () => undefined,
      },
      { wsUrl, gender: 'female' },
    );
    call = session;
    await session.start();
  } finally {
    starting = false;
  }
}

function notConfigured(): void {
  Alert.alert(
    'Pratham AI',
    'Pratham AI is not set up yet. Set PRATHAM_AI_URL on the server, or EXPO_PUBLIC_PRATHAM_AI_URL in the app.',
  );
}
