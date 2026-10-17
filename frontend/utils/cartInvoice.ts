import type { WishlistItem } from '@/types/wishlist';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { invoiceLinesInputFromPricing, type InvoicePricing } from '@/utils/invoiceLines';
import {
  buildInvoiceLines,
  roundHalfUp,
  sumLineAmounts,
  type InvoiceLineItemRow,
  type InvoiceLinesInput,
} from '@/utils/moneyMath';

/**
 * The cart (Wishlist -> tick several tags -> Add to cart) as plain logic:
 * which saved tags it holds, its Grand Total, and the one invoice that bills
 * them all — each piece's own invoice lines, one piece after another.
 *
 * No React and no native modules, so node loads it (with the '@/' alias
 * resolved) for utils/__tests__/cartInvoice.test.mjs: what is tested is what
 * the app runs.
 */

/** One saved tag in the cart. */
export interface CartPiece {
  /** The wishlist item's id. */
  id: string;
  /** Bold on the cart row: the catalogue name, else the wishlist title. */
  name: string;
  /** Muted under the name: the tag's code. */
  tagCode: string;
  /** The MRP as the wishlist card shows it: whole rupees, half-up. */
  mrp: number;
  /** The figures its invoice lines are built from; null when it cannot be billed. */
  lines: InvoiceLinesInput | null;
  /** Why it cannot be billed, as the cart says it; null when it can. */
  problem: string | null;
}

/** A piece whose saved breakdown can be billed. */
export type BillableCartPiece = CartPiece & { lines: InvoiceLinesInput; problem: null };

export function isBillablePiece(piece: CartPiece): piece is BillableCartPiece {
  return piece.lines !== null && piece.problem === null;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * "₹ 82,694": whole rupees, half-up, Indian grouping (the last three digits,
 * then pairs) — how the cart prints a price. Digits are grouped by hand, as
 * the phone's Intl and node's do not always agree. Null is "—".
 */
export function formatCartPrice(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return '—';
  const rounded = roundHalfUp(amount);
  const digits = String(Math.abs(rounded));
  const grouped =
    digits.length <= 3
      ? digits
      : `${digits.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',')},${digits.slice(-3)}`;
  return `₹ ${rounded < 0 ? '-' : ''}${grouped}`;
}

const rupees = (amount: number) => formatCartPrice(amount);

const RESCAN_HINT = 'Scan the tag again and add it to the wishlist.';

/**
 * The saved breakdown, when it is whole enough to bill. A wishlist item has
 * no scan behind it any more (no scan id to price it again with), and the
 * phone's own estimate leaves out wastage and the live rate, so an item
 * without its breakdown is named as such rather than billed at figures
 * nobody quoted.
 */
function readBreakdown(item: WishlistItem): { pricing: InvoicePricing } | { problem: string } {
  const pricing = item.snapshot?.pricing as (InvoicePricing & { pricingError?: unknown }) | undefined;
  if (!pricing || typeof pricing !== 'object') {
    return { problem: `Saved without its price breakdown, so it cannot be billed. ${RESCAN_HINT}` };
  }
  if (typeof pricing.pricingError === 'string' && pricing.pricingError.trim()) {
    return { problem: `Saved without a price (${pricing.pricingError.trim()}). ${RESCAN_HINT}` };
  }
  if (!finite(pricing.ultimateMrp) || pricing.ultimateMrp <= 0) {
    return { problem: `Saved without a price, so it cannot be billed. ${RESCAN_HINT}` };
  }
  if (
    !finite(pricing.netWtGrams) ||
    !finite(pricing.goldBasePrice) ||
    !finite(pricing.labourAmount) ||
    !finite(pricing.otherChargesAmount) ||
    !Array.isArray(pricing.stoneRows)
  ) {
    return { problem: `Saved without its price breakdown, so it cannot be billed. ${RESCAN_HINT}` };
  }
  // The cart's Grand Total adds up the prices the wishlist shows; a bill
  // made from a breakdown that came to something else would not be that
  // total.
  if (finite(item.totalMrp) && roundHalfUp(item.totalMrp) !== roundHalfUp(pricing.ultimateMrp)) {
    return {
      problem:
        `Its saved price (${rupees(item.totalMrp)}) and its price breakdown ` +
        `(${rupees(pricing.ultimateMrp)}) disagree, so it is not billed. ${RESCAN_HINT}`,
    };
  }
  return { pricing };
}

/** The catalogue name the tag matched, else the title the wishlist saved. */
export function cartPieceName(item: WishlistItem): string {
  return item.snapshot?.scanData?.itemName?.trim() || item.title?.trim() || 'Saved item';
}

/**
 * A wishlist item as a cart piece: its name, code and MRP as the wishlist
 * shows them, and the invoice figures from its saved breakdown — read the
 * way the single-item invoice reads it (karat from its own scan, its own
 * other charges), so it bills the same lines in a cart as alone.
 */
export function cartPieceFromWishlistItem(item: WishlistItem): CartPiece {
  const base = {
    id: item.id,
    name: cartPieceName(item),
    tagCode: item.tagCode?.trim() || '',
    mrp: roundHalfUp(finite(item.totalMrp) ? item.totalMrp : 0),
  };
  const read = readBreakdown(item);
  if ('problem' in read) return { ...base, lines: null, problem: read.problem };
  const scanData = item.snapshot?.scanData;
  return {
    ...base,
    lines: invoiceLinesInputFromPricing(read.pricing, {
      karatFallback: resolveScannedKarat(scanData?.karat, scanData?.tunch) || '14K',
      otherChargeItems: scanData?.otherChargesItems ?? [],
      otherChargeRemarks: scanData?.otherChargesRemarks ?? '',
    }),
    problem: null,
  };
}

/**
 * The cart's pieces, in the cart's order, from the wishlist as it stands. An
 * id the wishlist no longer has (removed since) is counted, not shown.
 */
export function resolveCart(
  ids: readonly string[],
  items: readonly WishlistItem[],
): { pieces: CartPiece[]; missing: number } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const pieces: CartPiece[] = [];
  let missing = 0;
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (item) pieces.push(cartPieceFromWishlistItem(item));
    else missing += 1;
  }
  return { pieces, missing };
}

/**
 * The ticked items in the wishlist's own order (the mockup's), whatever
 * order they were ticked in; ticks on items no longer listed drop out.
 */
export function selectionInListOrder(
  items: readonly { id: string }[],
  selected: ReadonlySet<string>,
): string[] {
  return items.map((item) => item.id).filter((id) => selected.has(id));
}

/** The cart's Grand Total: each piece's MRP as its card shows it, added up. */
export function cartGrandTotal(pieces: readonly { mrp: number }[]): number {
  return pieces.reduce((sum, piece) => sum + roundHalfUp(piece.mrp), 0);
}

/** One billed piece as POST /invoices/generate takes it in `pieces`. */
export interface CartInvoicePiecePayload {
  wishlist_item_id: string;
  item_name: string;
  tag_code: string;
  /** What the piece bills: the sum of its own lines (its MRP, rounded). */
  mrp: number;
}

export interface CartInvoice {
  /** Every piece's lines, one piece after another, in the cart's order. */
  rows: InvoiceLineItemRow[];
  pieces: CartInvoicePiecePayload[];
  /** The sum of the lines: the pieces' MRPs, each rounded once. */
  subtotal: number;
}

/** "1. 22K Gold Necklace · TAG-10432": how a piece is named on its first line. */
export function cartPieceLabel(index: number, piece: { name: string; tagCode: string }): string {
  const code = piece.tagCode && piece.tagCode !== piece.name ? ` · ${piece.tagCode}` : '';
  return `${index + 1}. ${piece.name}${code}`;
}

/**
 * One invoice for the whole cart. Each piece gets exactly the lines a
 * single-item invoice of it would (moneyMath.buildInvoiceLines on its own
 * breakdown, so its lines add up to its own MRP, rounded once); the lines
 * then follow one another in the cart's order. Nothing is shared out across
 * pieces, so one piece's rounding never moves another's figures.
 *
 * The first line of each piece names it in its note ("1. Diamond Ring ·
 * PK-1042 — 18K"), since the descriptions themselves stay the standard ones
 * the server reads a line's kind from ("Labour Charge", "Wastage …").
 */
export function buildCartInvoice(pieces: readonly BillableCartPiece[]): CartInvoice {
  const rows: InvoiceLineItemRow[] = [];
  const payload: CartInvoicePiecePayload[] = [];
  pieces.forEach((piece, index) => {
    const own = buildInvoiceLines(piece.lines);
    const label = cartPieceLabel(index, piece);
    own.forEach((row, lineIndex) => {
      const note =
        lineIndex === 0 ? (row.note && row.note !== '—' ? `${label} — ${row.note}` : label) : row.note;
      rows.push({ ...row, key: `piece-${index}-${row.key}`, note });
    });
    payload.push({
      wishlist_item_id: piece.id,
      item_name: piece.name,
      tag_code: piece.tagCode,
      mrp: sumLineAmounts(own),
    });
  });
  return { rows, pieces: payload, subtotal: sumLineAmounts(rows) };
}

/** A billed piece as GET /history/checkouts/:id returns it. */
export interface CheckoutPiece {
  itemName: string;
  tagCode: string;
  /** Null when the server sent no readable figure. */
  mrp: number | null;
}

/** A past cart: the invoice that billed it and the pieces it held. */
export interface CheckoutDetail {
  id: string;
  invoiceNumber: string;
  /** Null on an invoice issued before the server counted pieces. */
  pieceCount: number | null;
  pieces: CheckoutPiece[];
  grandTotal: number | null;
  createdAt: string;
  customerName: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readAmount(value: unknown): number | null {
  const amount = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
}

/**
 * GET /history/checkouts/:id's `item`, read defensively: unreadable pieces
 * are dropped, a missing figure is null rather than zero. Null when there is
 * no record at all.
 */
export function readCheckoutDetail(raw: unknown): CheckoutDetail | null {
  const item = asRecord(raw);
  if (!item) return null;
  const pieces: CheckoutPiece[] = [];
  if (Array.isArray(item.pieces)) {
    for (const entry of item.pieces) {
      const piece = asRecord(entry);
      if (!piece) continue;
      pieces.push({
        itemName: readText(piece, 'itemName'),
        tagCode: readText(piece, 'tagCode'),
        mrp: readAmount(piece.mrp),
      });
    }
  }
  const count = Number(item.pieceCount);
  return {
    id: readText(item, 'id') || readText(item, '_id'),
    invoiceNumber: readText(item, 'invoiceNumber'),
    pieceCount: item.pieceCount != null && Number.isInteger(count) && count > 0 ? count : null,
    pieces,
    grandTotal: readAmount(item.grandTotal),
    createdAt: readText(item, 'createdAt'),
    customerName: readText(item, 'customerName'),
  };
}
