import { Platform } from 'react-native';

/**
 * Selling inside the app, by platform.
 *
 * Android sells scan credits and the licence through Razorpay, as it always
 * has. The iPhone app sells nothing: Apple's rule 3.1.1 wants its own In-App
 * Purchase for digital goods bought in an iOS app, and the owner chose to go
 * in under 3.1.3(f) instead, as a free companion to the paid service. That
 * rule allows no purchasing in the app and no call to action to buy anywhere
 * else: no buy, recharge or upgrade button, no price on offer, nothing
 * pointing to a website, WhatsApp, a phone number or Android to pay. What
 * the account already has is shown as it stands: its credits, its licence,
 * the trial's end, its past payments.
 *
 * Every screen asks canPurchaseInApp(); the rest is plain text work, loaded
 * as-is by utils/__tests__/platformCommerce.test.mjs.
 */

/** Whether a build for this OS may sell anything. Only the iPhone may not. */
export function purchaseAllowedOn(os: string): boolean {
  return os !== 'ios';
}

/** False on iPhone: nothing is sold there, and nothing says where to buy. */
export function canPurchaseInApp(): boolean {
  return purchaseAllowedOn(Platform.OS);
}

/**
 * The Settings tile and the screen it opens, on iPhone, where that screen
 * reports the account and sells nothing. "Subscription" read as something
 * on offer.
 */
export const ACCOUNT_STATUS_TITLE = 'Credits & Licence';
export const ACCOUNT_STATUS_SUBTITLE = 'Your credits, usage and licence';

export const NO_CREDITS_LINE = 'No scan credits left on this account.';
export const LOW_CREDITS_LINE = 'Not enough scan credits left on this account for a scan.';
export const TRIAL_ENDED_LINE = 'Your free trial has ended.';
export const LICENCE_EXPIRED_LINE = 'Your licence has expired.';

/** The same fallback the scanner uses when the server names no minimum. */
const DEFAULT_MIN_SCAN_BALANCE = 0.74;

/** None left at all, or some but not a scan's worth. */
export function creditsLine(creditBalance: number): string {
  return Number(creditBalance || 0) > 0 ? LOW_CREDITS_LINE : NO_CREDITS_LINE;
}

/**
 * What the scanner says on iPhone when a tap on Scan cannot go through:
 * the reason, and nothing about where to buy. Null when it can go through.
 */
export function scanBlockedNotice(state: {
  trialExpired: boolean;
  creditsLow: boolean;
  outOfCredits: boolean;
  creditBalance: number;
}): { title: string; message: string } | null {
  if (state.trialExpired) {
    return {
      title: 'Free trial ended',
      message: state.creditsLow
        ? `${TRIAL_ENDED_LINE} ${creditsLine(state.creditBalance)}`
        : TRIAL_ENDED_LINE,
    };
  }
  if (state.outOfCredits) {
    return {
      title: Number(state.creditBalance || 0) > 0 ? 'Low credits' : 'No credits',
      message: creditsLine(state.creditBalance),
    };
  }
  return null;
}

/**
 * The account's state in plain lines for Credits & Licence on iPhone: a
 * licence that has run out, a trial that is over, a wallet that cannot pay
 * for a scan. Nothing for an account that is fine.
 */
export function accountStatusLines(account: {
  status: string;
  trialExpiredAt?: string | null;
  applicationPurchased?: boolean;
  creditBalance: number;
  minScanBalance?: number;
}): string[] {
  const lines: string[] = [];
  const licensed = account.status === 'PERMANENT_LICENSE' || account.status === 'PURCHASED'
    || Boolean(account.applicationPurchased);
  if (account.status === 'EXPIRED') lines.push(LICENCE_EXPIRED_LINE);
  else if (!licensed && account.trialExpiredAt) lines.push(TRIAL_ENDED_LINE);
  const minimum = Number(account.minScanBalance ?? DEFAULT_MIN_SCAN_BALANCE);
  if (Number(account.creditBalance || 0) <= minimum) lines.push(creditsLine(account.creditBalance));
  return lines;
}

/**
 * A sentence that tells the shop to buy: "Please recharge to continue",
 * "Purchase application to continue scanning", "Upgrade to a Subscription".
 * Matched only where a sentence starts, so "You purchased 500 credits" and
 * "made a purchase using your referral link" (what happened) stay.
 */
const BUY_SENTENCE =
  /(^|[.!?]\s+)((?:please\s+)?(?:purchase|buy|recharge|subscribe|renew|top[\s-]?up|add\s+(?:more\s+)?credits|upgrade\s+to)\b)/i;

/** Where the first sentence telling the shop to buy starts, or -1. */
function buySentenceStart(text: string): number {
  const match = BUY_SENTENCE.exec(text);
  return match ? match.index + match[1].length : -1;
}

/**
 * The text with every sentence that tells the shop to buy taken out:
 * "No credits available. Please add credits to continue scanning." reads
 * "No credits available." Empty when nothing else was said.
 */
export function withoutPurchaseCallToAction(text: string): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences
    .filter((sentence) => buySentenceStart(sentence) !== 0)
    .join(' ')
    .trim();
}

/**
 * A notification's words, cut where the first sentence telling the shop to
 * buy begins: "…only **15 credits** left. Recharge now to keep scanning."
 * ends at "left.", and "Your free trial has ended. Purchase the
 * **Subscription** to keep scanning." ends at "ended." The rest of the
 * sentence can sit in later pieces (the bold plan name), so they go too.
 */
export function notificationWithoutPurchaseCallToAction<T extends { text: string }>(segments: T[]): T[] {
  const whole = segments.map((segment) => segment.text).join('');
  const cut = buySentenceStart(whole);
  if (cut < 0) return segments;
  const kept: T[] = [];
  let offset = 0;
  for (const segment of segments) {
    const end = offset + segment.text.length;
    if (end <= cut) {
      kept.push(segment);
    } else {
      const head = segment.text.slice(0, Math.max(0, cut - offset));
      if (head.trim()) kept.push({ ...segment, text: head });
      break;
    }
    offset = end;
  }
  // The space before the cut sentence, wherever it ended up.
  const last = kept[kept.length - 1];
  if (last) kept[kept.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
  return kept.filter((segment) => segment.text.length > 0);
}

/**
 * The server's refusals said without sending the shop to buy, by the code
 * the API answers with (the body's `error`, or a bare code as the message).
 * On Android these codes read "Please purchase a license" or "Please add
 * credits"; on iPhone they state the account's position only.
 */
const STORE_SAFE_REFUSALS: Record<string, string> = {
  NO_CREDITS_AVAILABLE: NO_CREDITS_LINE,
  INSUFFICIENT_CREDITS: LOW_CREDITS_LINE,
  TRIAL_EXPIRED: TRIAL_ENDED_LINE,
  SCANNER_LICENSE_REQUIRED: TRIAL_ENDED_LINE,
  LICENSE_REQUIRED_FOR_CREDITS: TRIAL_ENDED_LINE,
  LICENSE_REQUIRED: 'This account has no active licence.',
  PERMANENT_LICENSE_REQUIRED: 'This is not included in this account’s licence.',
};

/** Said when everything the server wrote was about buying. */
export const NOT_AVAILABLE_ON_ACCOUNT = 'This is not available on this account right now.';

/**
 * A server message as the iPhone app may show it: the account's position for
 * a known licence or credits refusal, and any other text with its buying
 * sentences taken out. Text with none comes back exactly as it was.
 */
export function storeSafeServerMessage(code: unknown, message: string): string {
  const key = typeof code === 'string' ? code.trim() : '';
  if (key && STORE_SAFE_REFUSALS[key]) return STORE_SAFE_REFUSALS[key];
  const bare = message.trim();
  if (STORE_SAFE_REFUSALS[bare]) return STORE_SAFE_REFUSALS[bare];
  if (buySentenceStart(message) < 0) return message;
  return withoutPurchaseCallToAction(message) || NOT_AVAILABLE_ON_ACCOUNT;
}
