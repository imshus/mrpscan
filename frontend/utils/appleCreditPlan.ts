/**
 * iPhone credit recharge with a typed amount, as plain logic with no imports
 * (node loads this very file in utils/__tests__/appleCreditPlan.test.mjs).
 *
 * Apple only sells products made in App Store Connect, so a typed amount is
 * bought as credit packs: one pack (50/100/250/500/1,000/5,000) times a
 * quantity of up to 10 per purchase, StoreKit's limit. The fewest purchases
 * win: 2,000 is one (500 x 4), 2,350 is two (500 x 4, then 50 x 7). Each
 * purchase is one Apple confirmation; up to three cover every step of 50
 * from 50 to 50,000.
 */

export const APPLE_PACK_CREDITS = [5000, 1000, 500, 250, 100, 50] as const;
export const APPLE_MAX_QUANTITY = 10;
export const APPLE_MIN_CREDITS = 50;
export const APPLE_STEP_CREDITS = 50;
/** The 5,000 pack x 10. */
export const APPLE_MAX_CREDITS = 5000 * APPLE_MAX_QUANTITY;
export const APPLE_MAX_PURCHASES = 3;

export type ApplePurchaseStep = { credits: number; quantity: number };

/** Exactly `amount` in `count` purchases, the biggest packs first; null if none. */
function exactly(amount: number, count: number): ApplePurchaseStep[] | null {
  for (const credits of APPLE_PACK_CREDITS) {
    if (count === 1) {
      if (amount % credits === 0 && amount / credits <= APPLE_MAX_QUANTITY) {
        return [{ credits, quantity: amount / credits }];
      }
      continue;
    }
    for (let quantity = APPLE_MAX_QUANTITY; quantity >= 1; quantity -= 1) {
      const rest = amount - credits * quantity;
      if (rest <= 0) continue;
      const others = exactly(rest, count - 1);
      if (others) return [{ credits, quantity }, ...others];
    }
  }
  return null;
}

/** Why an amount cannot be bought on iPhone, or null when it can. */
export function appleAmountProblem(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Please enter the number of credits.';
  if (amount < APPLE_MIN_CREDITS) return `The minimum is ${APPLE_MIN_CREDITS} credits.`;
  if (amount > APPLE_MAX_CREDITS) return `The maximum is ${APPLE_MAX_CREDITS.toLocaleString('en-IN')} credits at a time.`;
  if (amount % APPLE_STEP_CREDITS !== 0) return `On iPhone, credits are bought in steps of ${APPLE_STEP_CREDITS} (50, 100, 150 …).`;
  return null;
}

/**
 * The purchases that buy exactly `amount` credits, as few as possible (one,
 * two or three). Null when the amount is not buyable.
 */
export function planAppleCredits(amount: number): ApplePurchaseStep[] | null {
  if (appleAmountProblem(amount)) return null;
  for (let count = 1; count <= APPLE_MAX_PURCHASES; count += 1) {
    const plan = exactly(amount, count);
    if (plan) return plan;
  }
  return null;
}
