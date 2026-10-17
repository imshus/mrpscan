import { parseNumericValue, parseWeightValue } from '@/utils/formulaUtils';
import {
  wastageLineRatePerGram,
  type InvoiceLinesInput,
  type InvoiceOtherCharge,
} from '@/utils/moneyMath';

/**
 * The pricing an invoice bills a piece from: the breakdown the result card
 * showed (FinalTabPricingResult), or the one a wishlist item saved with it.
 * Only the fields the invoice reads, so a saved snapshot and a live price
 * are taken the same way.
 */
export interface InvoicePricing {
  selectedKarat: string;
  netWtGrams: number;
  goldBasePrice: number;
  goldRatePerGram?: number;
  stoneRows: ReadonlyArray<{
    stoneType: 'diamond' | 'colorstone';
    quality: string;
    weight: string;
    rate: string;
    amount: number;
  }>;
  labourAmount: number;
  wastageWeightGrams?: number;
  wastageRatePerGram?: number;
  wastagePercent?: number;
  wastageAmount?: number;
  otherChargesAmount: number;
  ultimateMrp: number;
}

/** What goes with a pricing that the pricing itself does not carry. */
export interface InvoicePricingContext {
  /** The karat printed under the gold line when the pricing names none. */
  karatFallback: string;
  /** The other charges that pricing was made from: the piece's own list. */
  otherChargeItems: readonly InvoiceOtherCharge[];
  otherChargeRemarks?: string;
}

/**
 * One piece's pricing read into the figures its invoice lines are built from
 * (moneyMath.buildInvoiceLines). The single-scan invoice and every piece of a
 * cart go through this one reading, so a piece bills the same lines whether
 * it is invoiced alone or with others.
 */
export function invoiceLinesInputFromPricing(
  pricing: InvoicePricing,
  context: InvoicePricingContext,
): InvoiceLinesInput {
  return {
    karatNote: pricing.selectedKarat || context.karatFallback,
    netWtGrams: pricing.netWtGrams,
    goldAmount: pricing.goldBasePrice,
    // Stone lines come wholly from the preview's own rows — description,
    // carats and amount together. Zipping them against a fresh read of the
    // scan let the two lists disagree in length.
    stones: pricing.stoneRows.map((stone) => ({
      stoneType: stone.stoneType,
      quality: stone.quality,
      carats: parseWeightValue(stone.weight),
      amount: stone.amount,
      // The rate per carat the row showed: a discounted stone prints it,
      // with the discount beside it, rather than a net rate.
      listRate: Math.max(0, parseNumericValue(stone.rate)),
    })),
    labourAmount: pricing.labourAmount,
    // The wastage grams at the rate the server priced them at (the Current
    // Gold Rate per gram), so the line bills the MRP's wastage.
    wastage: {
      grams: pricing.wastageWeightGrams ?? 0,
      ratePerGram: wastageLineRatePerGram(pricing),
      percent: pricing.wastagePercent ?? 0,
      amount: pricing.wastageAmount ?? 0,
    },
    otherCharges: {
      items: context.otherChargeItems,
      remarks: context.otherChargeRemarks,
      total: pricing.otherChargesAmount,
    },
    mrp: pricing.ultimateMrp,
  };
}
