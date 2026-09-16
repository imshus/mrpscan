/**
 * A weight printed with its rate after it: "DIA WT 1.56/550" is 1.56 carats
 * at 550 a carat. The server splits the pair as it reads the tag, and this is
 * the same split applied to whatever reaches the app, so a reading from an
 * API that predates that split is still shown as a weight and a rate rather
 * than as one impossible number (1.56/550 parsed as a weight is 1.5655 ct).
 *
 * A weight is a small decimal and a rate a whole number of rupees, so only a
 * decimal followed by an integer is a pair: "0.50/0.25" is two weights, and a
 * weight followed by a letter code is not a rate either.
 */
const WEIGHT_RATE_PAIR = /^(\d{1,3}(?:\.\d{1,3})?)\s*[/\\|IlL]\s*(\d{2,7})$/;

export interface WeightRatePair {
  weight: string;
  rate: string;
}

/** The two numbers when the weight holds a pair, else null. */
export function splitWeightRate(weight: string): WeightRatePair | null {
  const match = String(weight ?? '').trim().match(WEIGHT_RATE_PAIR);
  if (!match) return null;
  return { weight: match[1], rate: match[2] };
}

/**
 * The weight and rate a stone should carry: the pair split when the weight
 * holds one, and a rate printed in its own field never replaced.
 */
export function resolveWeightAndRate(weight: string, rate: string): WeightRatePair {
  const pair = splitWeightRate(weight);
  if (!pair) return { weight: String(weight ?? '').trim(), rate: String(rate ?? '').trim() };
  const printedRate = String(rate ?? '').trim();
  return { weight: pair.weight, rate: printedRate || pair.rate };
}
