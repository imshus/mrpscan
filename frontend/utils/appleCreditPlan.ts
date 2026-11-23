/**
 * iPhone credit recharge with a typed amount, as plain logic with no imports
 * (node loads this very file in utils/__tests__/appleCreditPlan.test.mjs).
 *
 * Apple only sells products made in App Store Connect, so a typed amount is
 * bought as credit packs: one pack (50/100/250/500) times a quantity of up
 * to 10 per purchase, StoreKit's limit. The fewest purchases win: 2,000 is
 * one (500 x 4), 2,350 is two (500 x 4, then 50 x 7). Each purchase is one
 * Apple confirmation, so at most two are allowed.
 */

export const APPLE_PACK_CREDITS = [500, 250, 100, 50] as const;
export const APPLE_MAX_QUANTITY = 10;
export const APPLE_MIN_CREDITS = 50;
export const APPLE_STEP_CREDITS = 50;
/**
 * The 500 pack x 10. Every step of 50 up to here takes at most two
 * purchases; above it some would take three. More can be bought again.
 */
export const APPLE_MAX_CREDITS = 500 * APPLE_MAX_QUANTITY;

export type ApplePurchaseStep = { credits: number; quantity: number };

/** One pack x quantity covering exactly `amount`, the biggest pack first. */
function single(amount: number): ApplePurchaseStep | null {
  for (const credits of APPLE_PACK_CREDITS) {
    if (amount % credits === 0 && amount / credits <= APPLE_MAX_QUANTITY) {
      return { credits, quantity: amount / credits };
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
 * The purchases that buy exactly `amount` credits: one when a single pack x
 * quantity covers it, otherwise two. Null when the amount is not buyable.
 */
export function planAppleCredits(amount: number): ApplePurchaseStep[] | null {
  if (appleAmountProblem(amount)) return null;
  const one = single(amount);
  if (one) return [one];
  for (const credits of APPLE_PACK_CREDITS) {
    for (let quantity = APPLE_MAX_QUANTITY; quantity >= 1; quantity -= 1) {
      const rest = amount - credits * quantity;
      if (rest <= 0) continue;
      const second = single(rest);
      if (second) return [{ credits, quantity }, second];
    }
  }
  return null;
}
