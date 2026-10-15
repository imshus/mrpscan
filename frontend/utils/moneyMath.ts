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

/**
 * numerator / denominator rounded half-up, for whole numbers (backend
 * utils/money.divHalfUp). Exact while the operands stay below 2^53.
 */
function divHalfUp(numerator: number, denominator: number): number {
  const negative = numerator < 0 !== denominator < 0;
  const num = Math.abs(numerator);
  const den = Math.abs(denominator);
  const quotient = Math.floor((2 * num + den) / (2 * den));
  return negative && quotient !== 0 ? -quotient : quotient;
}

/**
 * Whether the shop charges CGST + SGST rather than IGST — the server's rule
 * (backend invoiceMath.isIntraStateSupply): a supplier GSTIN starting 07,
 * Delhi.
 */
export function isIntraStateSupplier(supplierGstin: string | null | undefined): boolean {
  return String(supplierGstin ?? '').trim().slice(0, 2) === '07';
}

/** The invoice's tax heads, in rupees to the paisa. */
export interface InvoiceTax {
  cgst: number;
  sgst: number;
  igst: number;
  /** CGST + SGST + IGST. */
  gst: number;
}

/**
 * GST exactly as the server works it out and prints it (backend
 * invoiceMath.computeInvoiceFigures): each line taxed on its own amount in
 * whole paise, half-up — CGST and SGST each at half the rate for an
 * intra-state supplier, IGST at the full rate otherwise — and each head the
 * sum of its line taxes. Taxing the subtotal once instead lost the half paisa
 * every odd-rupee line carries under CGST and SGST, so a Delhi bill could
 * total a rupee under the PDF.
 */
export function computeInvoiceTax(
  lineAmounts: readonly number[],
  gstRatePercent: number,
  intraState: boolean,
): InvoiceTax {
  if (!Number.isFinite(gstRatePercent) || gstRatePercent <= 0) {
    return { cgst: 0, sgst: 0, igst: 0, gst: 0 };
  }
  const rateBasisPoints = toPaise(roundHalfUp(gstRatePercent, 2));
  let halfPaise = 0;
  let igstPaise = 0;
  for (const amount of lineAmounts) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const amountPaise = toPaise(amount);
    if (intraState) halfPaise += divHalfUp(amountPaise * rateBasisPoints, 20000);
    else igstPaise += divHalfUp(amountPaise * rateBasisPoints, 10000);
  }
  return {
    cgst: halfPaise / 100,
    sgst: halfPaise / 100,
    igst: igstPaise / 100,
    gst: (2 * halfPaise + igstPaise) / 100,
  };
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
    /** The rate per carat the card showed, before any discount; 0 if unknown. */
    listRate?: number;
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
  /** The quantity as printed and registered: to QTY_DECIMALS places. */
  qty: number;
  qtyUnit: string;
  exact: number;
  /** 'unit': price per gram/carat; 'lump': the amount is the price. */
  kind: 'unit' | 'lump';
  /**
   * The rate the line is quoted at (wastage: the 24K rate per gram; a stone:
   * its rate per carat). Printed when Qty × it rounds to the billed amount.
   */
  listPrice?: number;
  /** A stone sold below its list rate: the list rate prints beside a discount. */
  discounted?: boolean;
}

/** Amounts under half a paisa are no amount at all. */
const NEGLIGIBLE = 0.005;

/**
 * Places a quantity prints and registers to: grams to the milligram, carats
 * to the thousandth (the PDF and the server's figures both round there).
 */
const QTY_DECIMALS = 3;

/**
 * Whether the server reads a line as discounted (backend
 * invoiceMath.computeInvoiceFigures): Qty × Price at the quantity it
 * registers is more than a rupee above the amount billed. It then prints
 * "Less discount" for the gap and registers it as the line's Discount.
 */
export function serverSeesDiscount(qty: number, price: number, amount: number): boolean {
  const qtyRegistered = roundHalfUp(qty, QTY_DECIMALS);
  const listPrice = roundHalfUp(price, 3);
  if (!(qtyRegistered > 0) || !(listPrice > 0)) return false;
  return toPaise(qtyRegistered * listPrice) - toPaise(amount) > 100;
}

/**
 * The per-unit price printed for a billed amount, such that Qty × Price
 * rounds to it on the printed quantity: the line's list rate when it does,
 * else its own rate (the exact amount over the quantity), else the billed
 * amount over the quantity, to the paisa, nudged a paisa either way if
 * needed so it rounds back.
 */
function unitPrice(qty: number, exact: number, billed: number, listPrice?: number): number {
  const closes = (price: number) => roundHalfUp(qty * price) === billed;
  if (listPrice !== undefined && closes(listPrice)) return listPrice;
  const own = roundHalfUp(exact / qty, 2);
  if (closes(own)) return own;
  const derived = roundHalfUp(billed / qty, 2);
  for (const candidate of [derived, roundHalfUp(derived - 0.01, 2), roundHalfUp(derived + 0.01, 2)]) {
    if (closes(candidate)) return candidate;
  }
  return derived;
}

/**
 * The price a per-unit line prints. A stone sold below its list rate prints
 * that rate, so the server shows and registers the discount — but only when
 * the gap is one the server reads as a discount (over a rupee); a smaller
 * one is the line's own rounding, and the line prints a price that closes.
 */
function linePrice(draft: DraftLine, billed: number): number {
  const list =
    draft.listPrice !== undefined && draft.listPrice > 0 ? roundHalfUp(draft.listPrice, 2) : undefined;
  if (list !== undefined && draft.discounted && serverSeesDiscount(draft.qty, list, billed)) {
    return list;
  }
  return unitPrice(draft.qty, draft.exact, billed, list);
}

/**
 * The invoice's lines, in the card's order — gold, stones, labour, wastage,
 * other charges — with whole-rupee amounts that add up to the MRP the card
 * showed, rounded once. Wastage is its own line, as gold: the grams wasted,
 * priced at the 24K rate per gram. Without it the bill came to less than the
 * MRP quoted by the whole wastage amount.
 *
 * Each per-unit line prints a quantity to 3 places and a price such that
 * Qty × Price rounds to its Amount — the quoted rate whenever it does — so
 * the server (backend invoiceMath) never reads a discount into it. The one
 * exception is a stone sold below its list rate: it prints the list rate and
 * the server shows and registers the discount.
 */
export function buildInvoiceLines(input: InvoiceLinesInput): InvoiceLineItemRow[] {
  const drafts: DraftLine[] = [];

  // Every per-unit quantity is the one printed and registered, to three
  // places, and its price is worked out on that: a price fitted to 0.3728 g
  // did not foot on the 0.373 g printed, and the server read the gap as a
  // discount.
  const printedQty = (value: number) =>
    Number.isFinite(value) && value > 0 ? roundHalfUp(value, QTY_DECIMALS) : 0;

  drafts.push({
    key: 'gold-base-metal',
    description: 'Gold (in grams)',
    note: input.karatNote || '—',
    qty: printedQty(input.netWtGrams),
    qtyUnit: 'g',
    exact: Math.max(0, input.goldAmount),
    kind: 'unit',
  });

  input.stones.forEach((stone, index) => {
    const listRate = Number.isFinite(stone.listRate) && (stone.listRate ?? 0) > 0 ? stone.listRate : undefined;
    const amount = Math.max(0, stone.amount);
    drafts.push({
      key: `stone-${stone.stoneType}-${index}`,
      description: stone.stoneType === 'diamond' ? 'Diamond (in carats)' : 'Colorstone (in carats)',
      note: stone.quality && stone.quality !== '—' ? stone.quality : '',
      qty: printedQty(stone.carats),
      qtyUnit: 'Ct',
      exact: amount,
      kind: 'unit',
      listPrice: listRate,
      // Priced below carats × its rate: a discount on the rate, which the
      // invoice shows against the rate the card showed.
      discounted: listRate !== undefined && stone.carats * listRate - amount >= NEGLIGIBLE,
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
      qty: printedQty(grams),
      qtyUnit: 'g',
      exact: input.wastage.amount,
      kind: 'unit',
      // The 24K rate per gram prints when the printed grams at it round to
      // the amount billed; otherwise a price that does, so the line foots
      // and the server never reads a discount into it.
      listPrice: ratePerGram > 0 ? ratePerGram : undefined,
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
    } else {
      price = linePrice(draft, amount);
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
