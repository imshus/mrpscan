import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

/** Support address, baked in at build time from EXPO_PUBLIC_SUPPORT_EMAIL in .env. */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();

/** The browser voice agent a customer talks to; EXPO_PUBLIC_VOICE_AGENT_URL overrides it. */
export const VOICE_AGENT_URL =
  (process.env.EXPO_PUBLIC_VOICE_AGENT_URL ?? '').trim() || 'https://voice.amitaash.com';

/**
 * Opens the phone's own email app on a new message, addressed to support
 * when an address is configured and left blank for the user to fill otherwise.
 */
export async function openSupportEmail(businessName?: string | null): Promise<void> {
  const subject = encodeURIComponent(
    businessName ? `MRPscan support: ${businessName}` : 'MRPscan support',
  );
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  } catch {
    Alert.alert('No email app', 'Set up an email app on this phone, then try again.');
  }
}

/**
 * Opens the voice agent in an in-app browser tab. A browser tab rather than a
 * WebView because the agent needs the microphone, and the browser handles
 * that permission prompt itself.
 */
export async function talkToAgent(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(VOICE_AGENT_URL);
  } catch {
    try {
      await Linking.openURL(VOICE_AGENT_URL);
    } catch {
      Alert.alert('Cannot open the agent', `Open ${VOICE_AGENT_URL} in your browser.`);
    }
  }
}
