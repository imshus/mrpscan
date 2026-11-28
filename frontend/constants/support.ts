import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

/** Support inbox the "Email Us" row writes to; EXPO_PUBLIC_SUPPORT_EMAIL overrides it. */
export const SUPPORT_EMAIL =
  (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim() || 'info@mrpscan.com';

/**
 * The number the "Mobile Number (owner)" row dials; EXPO_PUBLIC_SUPPORT_PHONE
 * overrides it. Stored in full international form so a tap dials from any
 * network, and shown as the owner writes it.
 */
export const SUPPORT_PHONE =
  (process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '').trim() || '+918796332440';

/**
 * The voice agent's own web page, which "Request for Custom Feature" opens;
 * EXPO_PUBLIC_VOICE_AGENT_URL overrides it. Moved to prathamai.mrpscan.com
 * (owner, 28 Nov 2026).
 */
export const VOICE_AGENT_URL =
  (process.env.EXPO_PUBLIC_VOICE_AGENT_URL ?? '').trim() || 'https://prathamai.mrpscan.com/';

/** Subject line the support email opens with. */
export const SUPPORT_EMAIL_SUBJECT = 'MRPscan:Amitaash IT Solutions Private Limited';

const INVITE_URL = 'https://mrpscan.com';

/** The message Earn & Invite shares, carrying the sender's referral code. */
export function buildInviteMessage(referralCode: string): string {
  return (
    'You are invited to MRPscan — photograph a jewellery tag, get the MRP, ' +
    `print the bill. Use my referral code ${referralCode} when you sign up: ${INVITE_URL}`
  );
}

/** Opens the phone's own email app on a new message to the support inbox. */
export async function openSupportEmail(): Promise<void> {
  const subject = encodeURIComponent(SUPPORT_EMAIL_SUBJECT);
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  } catch {
    Alert.alert('No email app', 'Set up an email app on this phone, then try again.');
  }
}

/** Opens the phone's dialler on the owner's number, already filled in. */
export async function callHelpline(): Promise<void> {
  try {
    await Linking.openURL(`tel:${SUPPORT_PHONE}`);
  } catch {
    Alert.alert('Cannot dial', `Call ${SUPPORT_PHONE} from your phone.`);
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
