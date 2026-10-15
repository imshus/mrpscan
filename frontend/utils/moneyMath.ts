/**
 * Money arithmetic: commercial half-up rounding, the invoice's lines and its
 * totals.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/moneyMath.test.mjs, so what is tested is what the app runs.
 *
 * Rounding is commercial HALF-UP (a half goes away from zero), the same
 * wherever a figure is rounded: the card's MRP, the invoice lines, the GST,
 * the grand total and the karat rate rows. Plain Math.round on a float is not
 * that: 0.284 ct × ₹87,500 less 5% is exactly 23,607.50, but the float comes
 * out as 23607.499999999996 and Math.round answers 23,607. The figures are
 * products of a few decimals (weights to 3 places, rates and percents to 2),
 * and the float error on them is far below a millionth of a rupee, so each
 * value is first snapped to a millionth of a rupee and then rounded.
 */

/** Decimal places of a rupee a value is snapped to before it is rounded. */
const SNAP_RUPEE_DECIMALS = 6;

/**
 * `value` rounded half-up (away from zero) to `decimals` places — whole
 * rupees by default, 2 for paise.
 */
export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  const snapped = Number(scaled.toFixed(Math.max(0, SNAP_RUPEE_DECIMALS - decimals)));
  const rounded = Math.floor(snapped + 0.5) / factor;
  if (rounded === 0) return 0;
  return value < 0 ? -rounded : rounded;
}

/** Whole paise, half-up. */
export function toPaise(value: number): number {
  return Math.round(roundHalfUp(value, 2) * 100);
}

/**
 * Whole rupees for each amount such that they add up to `target` — the
 * largest-remainder method. Each amount gets its floor, and the rupees still
 * missing go one each to the amounts with the largest fractional part (ties:
 * the larger amount, then the earlier one), so no amount moves by a rupee or
 * more. Rounding every amount on its own made the lines add up to a rupee or
 * more off the rounded total.
 *
 * Returns null when the amounts cannot reach `target` that way (a negative
 * amount, or a target outside floor-sum … ceiling-sum): the amounts and the
 * total disagree, and the caller decides.
 */
export function allocateWholeRupees(amounts: readonly number[], target: number): number[] | null {
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) return null;
  if (!Number.isInteger(target)) return null;
  const MICRO = 10 ** SNAP_RUPEE_DECIMALS;
  const micros = amounts.map((amount) => Math.round(Number(amount.toFixed(SNAP_RUPEE_DECIMALS)) * MICRO));
  const floors = micros.map((micro) => Math.floor(micro / MICRO));
  const remainders = micros.map((micro, index) => micro - floors[index] * MICRO);
  const missing = target - floors.reduce((sum, floor) => sum + floor, 0);
  const candidates = remainders
    .map((remainder, index) => ({ remainder, index }))
    .filter((entry) => entry.remainder > 0)
    .sort(
      (a, b) =>
        b.remainder - a.remainder ||
        micros[b.index] - micros[a.index] ||
        a.index - b.index,
    );
  if (missing < 0 || missing > candidates.length) return null;
  const result = floors.slice();
  for (let k = 0; k < missing; k += 1) result[candidates[k].index] += 1;
  return result;
}

/** GST on a subtotal, half-up to the paisa. */
export function computeGstAmount(subtotal: number, gstRatePercent: number): number {
  if (!Number.isFinite(subtotal) || !Number.isFinite(gstRatePercent)) return 0;
  return roundHalfUp((toPaise(subtotal) * gstRatePercent) / 100) / 100;
}

/** The grand total the invoice prints: subtotal plus GST, half-up to the rupee. */
export function computeGrandTotal(subtotal: number, gstAmount: number): number {
  return roundHalfUp((toPaise(subtotal) + toPaise(gstAmount)) / 100);
}

/** One printed invoice line. */
export interface InvoiceLineItemRow {
  key: string;
  description: string;
  note: string;
  qty: number;
  qtyUnit: string;
  price: number;
  amount: number;
}

export interface InvoiceOtherCharge {
  id: string;
  name: string;
  amount: number;
}

/**
 * The figures an invoice is built from — the very ones the card showed —
 * already read into numbers.
 */
export interface InvoiceLinesInput {
  /** The karat printed under the gold line ("18K"). */
  karatNote: string;
  netWtGrams: number;
  goldAmount: number;
  stones: ReadonlyArray<{
    stoneType: 'diamond' | 'colorstone';
    quality: string;
    carats: number;
    amount: number;
  }>;
  labourAmount: number;
  /** Wastage: grams of metal at the 24K rate per gram, as the server priced it. */
  wastage: { grams: number; ratePerGram: number; percent: number; amount: number };
  otherCharges: {
    items: readonly InvoiceOtherCharge[];
    remarks?: string;
    /** Other charges as priced into the MRP. */
    total: number;
  };
  /** The MRP the card showed, unrounded; the lines add up to it rounded. */
  mrp: number;
}

interface DraftLine {
  key: string;
  description: string;
  note: string;
  qty: number;
  qtyUnit: string;
  exact: number;
  /** 'unit': price per gram/carat; 'lump': the amount is the price. */
  kind: 'unit' | 'lump';
  /** A per-unit price the line must print, whatever its billed amount. */
  fixedPrice?: number;
}

/** Amounts under half a paisa are no amount at all. */
const NEGLIGIBLE = 0.005;

/**
 * The per-unit price printed for a billed amount: the line's own rate when
 * Qty × that rate rounds to the amount, else the amount over the quantity,
 * to the paisa, nudged a paisa either way if needed so it rounds back.
 */
function unitPrice(qty: number, exact: number, billed: number): number {
  const closes = (price: number) => roundHalfUp(qty * price) === billed;
  const own = roundHalfUp(exact / qty, 2);
  if (closes(own)) return own;
  const derived = roundHalfUp(billed / qty, 2);
  for (const candidate of [derived, roundHalfUp(derived - 0.01, 2), roundHalfUp(derived + 0.01, 2)]) {
    if (closes(candidate)) return candidate;
  }
  return derived;
}

/**
 * The invoice's lines, in the card's order — gold, stones, labour, wastage,
 * other charges — with whole-rupee amounts that add up to the MRP the card
 * showed, rounded once. Wastage is its own line, as gold: the grams wasted at
 * the 24K rate per gram. Without it the bill came to less than the MRP quoted
 * by the whole wastage amount.
 */
export function buildInvoiceLines(input: InvoiceLinesInput): InvoiceLineItemRow[] {
  const drafts: DraftLine[] = [];

  drafts.push({
    key: 'gold-base-metal',
    description: 'Gold (in grams)',
    note: input.karatNote || '—',
    qty: input.netWtGrams,
    qtyUnit: 'g',
    exact: Math.max(0, input.goldAmount),
    kind: 'unit',
  });

  input.stones.forEach((stone, index) => {
    drafts.push({
      key: `stone-${stone.stoneType}-${index}`,
      description: stone.stoneType === 'diamond' ? 'Diamond (in carats)' : 'Colorstone (in carats)',
      note: stone.quality && stone.quality !== '—' ? stone.quality : '',
      qty: stone.carats,
      qtyUnit: 'Ct',
      exact: Math.max(0, stone.amount),
      kind: 'unit',
    });
  });

  if (input.labourAmount >= NEGLIGIBLE) {
    drafts.push({
      key: 'labour-charge',
      description: 'Labour Charge',
      // No amount echoed under the name and no quantity of 1.000: the labour
      // line carries its figure in the Amount column alone, at the shop's
      // asking.
      note: '',
      qty: 0,
      qtyUnit: '',
      exact: input.labourAmount,
      kind: 'lump',
    });
  }

  if (input.wastage.amount >= NEGLIGIBLE) {
    const ratePerGram = input.wastage.ratePerGram;
    const grams =
      input.wastage.grams > 0
        ? input.wastage.grams
        : ratePerGram > 0
          ? input.wastage.amount / ratePerGram
          : 0;
    drafts.push({
      key: 'wastage',
      description: 'Wastage (in grams)',
      note: input.wastage.percent > 0 ? `${input.wastage.percent}%` : '',
      qty: grams,
      qtyUnit: 'g',
      exact: input.wastage.amount,
      kind: 'unit',
      fixedPrice: ratePerGram > 0 ? roundHalfUp(ratePerGram, 2) : undefined,
    });
  }

  // Other charges as they were priced into the MRP: the named items when
  // they add up to that figure, else that figure on one line — a list that
  // has since been edited, or belongs to another piece, must not change what
  // the quoted price bills.
  const { items, remarks, total } = input.otherCharges;
  const chargeNote = remarks?.trim() ? `Other Charges — ${remarks.trim()}` : 'Other Charges';
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  if (Math.abs(itemsTotal - total) < NEGLIGIBLE) {
    for (const item of items) {
      drafts.push({
        key: `other-charge-${item.id}`,
        description: item.name,
        note: chargeNote,
        qty: 1,
        qtyUnit: '',
        exact: Math.max(0, Number(item.amount) || 0),
        kind: 'lump',
      });
    }
  } else if (total >= NEGLIGIBLE) {
    drafts.push({
      key: 'other-charges',
      description: 'Other Charges',
      note: remarks?.trim() ? remarks.trim() : '',
      qty: 1,
      qtyUnit: '',
      exact: total,
      kind: 'lump',
    });
  }

  // One rounding: the MRP, half-up. The lines share out exactly that many
  // rupees. Lines that do not add up to the MRP at all (they disagree by a
  // rupee or more) are billed each at its own half-up figure instead.
  const exacts = drafts.map((draft) => draft.exact);
  const billed =
    allocateWholeRupees(exacts, roundHalfUp(input.mrp)) ?? exacts.map((exact) => roundHalfUp(exact));

  return drafts.map((draft, index) => {
    const amount = billed[index];
    let price: number;
    if (draft.kind === 'lump') {
      price = amount;
    } else if (!(draft.qty > 0)) {
      price = 0;
    } else if (draft.fixedPrice !== undefined) {
      price = draft.fixedPrice;
    } else {
      price = unitPrice(draft.qty, draft.exact, amount);
    }
    return {
      key: draft.key,
      description: draft.description,
      note: draft.note,
      qty: draft.qty,
      qtyUnit: draft.qtyUnit,
      price,
      amount,
    };
  });
}

/** The sum of the printed line amounts. */
export function sumLineAmounts(rows: readonly InvoiceLineItemRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
