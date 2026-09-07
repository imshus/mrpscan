import { Linking, Share } from 'react-native';

/**
 * How a shop reaches MRPscan, and how it invites others.
 *
 * Both contact points come from the build's environment so they can be
 * changed without touching code: EXPO_PUBLIC_SUPPORT_EMAIL and
 * EXPO_PUBLIC_SUPPORT_PHONE in frontend/.env. Until they are set, the two
 * Contact Us options say so instead of doing nothing.
 */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
export const SUPPORT_PHONE = (process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? '').replace(/[^\d+]/g, '');

const INVITE_URL = 'https://mrpscan.com';

export const INVITE_MESSAGE =
  'I price jewellery straight from the tag with MRPscan: photograph the tag, ' +
  `get the MRP, print the bill. Try it: ${INVITE_URL}`;

/** Opens the phone's mail app addressed to support, with the subject filled in. */
export async function openSupportEmail(businessName?: string): Promise<boolean> {
  if (!SUPPORT_EMAIL) return false;
  const subject = encodeURIComponent(
    businessName ? `MRPscan support — ${businessName}` : 'MRPscan support',
  );
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
    return true;
  } catch {
    return false;
  }
}

/** Opens the dialler on the customer care line. */
export async function callSupport(): Promise<boolean> {
  if (!SUPPORT_PHONE) return false;
  try {
    await Linking.openURL(`tel:${SUPPORT_PHONE}`);
    return true;
  } catch {
    return false;
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
