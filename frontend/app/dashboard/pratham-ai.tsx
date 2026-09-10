import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, Phone, PhoneOff } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRATHAM_AI_URL_FALLBACK, toAgentWsUrl } from '@/constants/prathamAi';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchAppConfig } from '@/utils/appConfigApi';
import { PrathamAiCall, type CallStatus, type TranscriptLine } from '@/utils/prathamAiCall';

const STATUS_TEXT: Record<CallStatus, string> = {
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Pratham AI is speaking…',
  ended: 'Call ended.',
  error: 'Could not connect.',
};

const NOT_CONFIGURED =
  'Pratham AI is not set up yet. Set PRATHAM_AI_URL on the server, or EXPO_PUBLIC_PRATHAM_AI_URL in the app.';

// The in-app call needs the phone's microphone through the native audio
// module, which the web build does not have. In a browser the agent's own
// hosted page does the call, so the tab opens that instead of failing.
const IS_WEB = Platform.OS === 'web';

/**
 * Pratham AI: opening this tab places the call at once — no page, no
 * browser — and the transcript fills in as the two of you talk. The call
 * ends from the red button, when you say so ("cut the call", "bye"), or
 * after ten seconds of silence; leaving the tab hangs up too.
 */
export default function PrathamAiScreen() {
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [detail, setDetail] = useState<string | undefined>();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [pageUrl, setPageUrl] = useState('');
  const callRef = useRef<PrathamAiCall | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const startCall = useCallback(async () => {
    callRef.current?.hangUp();
    callRef.current = null;
    setLines([]);
    setDetail(undefined);
    setStatus('connecting');

    const config = await fetchAppConfig();
    const base = (config.prathamAiUrl || PRATHAM_AI_URL_FALLBACK).trim();
    if (IS_WEB) {
      setPageUrl(base);
      setStatus(base ? 'ended' : 'error');
      setDetail(base ? 'In the browser, Pratham AI opens as its own page.' : NOT_CONFIGURED);
      return;
    }
    const wsUrl = toAgentWsUrl(base);
    if (!wsUrl) {
      setStatus('error');
      setDetail(NOT_CONFIGURED);
      return;
    }

    const call = new PrathamAiCall(
      {
        onStatus: (next, text) => {
          if (callRef.current !== call) return;
          setStatus(next);
          setDetail(text);
        },
        onTranscript: (next) => {
          if (callRef.current !== call) return;
          setLines(next);
        },
      },
      { wsUrl, gender: 'female' },
    );
    callRef.current = call;
    await call.start();
  }, []);

  const endCall = useCallback(() => {
    callRef.current?.hangUp();
  }, []);

  // The tab is the call: arriving dials, leaving hangs up.
  useFocusEffect(
    useCallback(() => {
      void startCall();
      return () => {
        callRef.current?.hangUp();
        callRef.current = null;
      };
    }, [startCall]),
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [lines]);

  const live = status === 'connecting' || status === 'listening' || status === 'speaking';
  const statusText = detail || STATUS_TEXT[status];

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Pratham AI" subtitle={statusText} />
      <View style={styles.body}>
        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {lines.length === 0 ? (
            <Text style={styles.empty}>
              {live ? 'Say hello — Pratham AI is on the line.' : statusText}
            </Text>
          ) : (
            lines.map((line) => (
              <View
                key={line.id}
                style={[
                  styles.bubble,
                  line.role === 'user' ? styles.bubbleUser : styles.bubbleAgent,
                  line.interrupted && styles.bubbleInterrupted,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    line.role === 'user' && styles.bubbleTextUser,
                    line.partial && styles.bubbleTextPartial,
                  ]}
                >
                  {line.text}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.controls}>
          <View style={[styles.statusDot, live ? styles.statusDotLive : styles.statusDotOff]} />
          <Text style={styles.statusLine} numberOfLines={2}>
            {statusText}
          </Text>
          {IS_WEB && pageUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(pageUrl)}
              accessibilityRole="button"
              accessibilityLabel="Open Pratham AI"
              style={({ pressed }) => [styles.callBtn, styles.callBtnStart, pressed && styles.callBtnPressed]}
            >
              <ExternalLink size={22} color={Colors.white} />
              <Text style={styles.callBtnText}>Open Pratham AI</Text>
            </Pressable>
          ) : live ? (
            <Pressable
              onPress={endCall}
              accessibilityRole="button"
              accessibilityLabel="End call"
              style={({ pressed }) => [styles.callBtn, styles.callBtnEnd, pressed && styles.callBtnPressed]}
            >
              <PhoneOff size={22} color={Colors.white} />
              <Text style={styles.callBtnText}>End call</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void startCall()}
              accessibilityRole="button"
              accessibilityLabel="Call again"
              style={({ pressed }) => [styles.callBtn, styles.callBtnStart, pressed && styles.callBtnPressed]}
            >
              <Phone size={22} color={Colors.white} />
              <Text style={styles.callBtnText}>Call again</Text>
            </Pressable>
          )}
        </View>
      </View>
      <BottomNav activeRoute="ai" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.screenBottom,
  },
  transcript: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
  },
  transcriptContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    color: Colors.textMuted,
    paddingVertical: 40,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.brandDeep,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleInterrupted: {
    opacity: 0.7,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  bubbleTextUser: {
    color: Colors.white,
  },
  bubbleTextPartial: {
    fontStyle: 'italic',
  },
  controls: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLive: {
    backgroundColor: Colors.successText,
  },
  statusDotOff: {
    backgroundColor: Colors.placeholder,
  },
  statusLine: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: Spacing.buttonHeight,
    paddingHorizontal: 28,
    borderRadius: Radius.button,
  },
  callBtnEnd: {
    backgroundColor: Colors.primary,
  },
  callBtnStart: {
    backgroundColor: Colors.successText,
  },
  callBtnPressed: {
    opacity: 0.85,
  },
  callBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
});
