import { Alert, Linking, Share } from 'react-native';

/**
 * Support contact details are baked into the bundle at build time from
 * EXPO_PUBLIC_SUPPORT_EMAIL and EXPO_PUBLIC_SUPPORT_PHONE in .env.
 */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
export const SUPPORT_PHONE = (process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '').replace(/[^\d+]/g, '');

const INVITE_URL = 'https://mrpscan.com';

export const INVITE_MESSAGE =
  'I price jewellery straight from the tag with MRPscan: photograph the tag, ' +
  `get the MRP, print the bill. Try it: ${INVITE_URL}`;

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

/** Dials the customer care line. */
export async function callSupport(): Promise<void> {
  if (!SUPPORT_PHONE) {
    Alert.alert('Customer care', 'The customer care number is not set up in this build yet.');
    return;
  }
  try {
    await Linking.openURL(`tel:${SUPPORT_PHONE}`);
  } catch {
    Alert.alert('Cannot place the call', `Dial ${SUPPORT_PHONE} from your phone app.`);
  }
}

/** The phone's share sheet with the invitation, for WhatsApp, SMS or anything else. */
export async function shareInvite(): Promise<void> {
  try {
    await Share.share({ message: INVITE_MESSAGE });
  } catch {
    // The user dismissed the sheet, or the platform has none; nothing to do.
  }
}
