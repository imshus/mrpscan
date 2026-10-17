/**
 * Settings → History, as plain logic: when a row happened ("Today, 8:59 am"),
 * its price in rupees with Indian grouping ("₹ 1,14,131"), and the three
 * lists — tag scans, wishlist, checkouts — turned into the rows the card
 * shows (mockup hcRenderLists / fmtWhen / fmtINR).
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/historyFormat.test.mjs, so what is tested is what the app
 * runs. The dates and digits are put together by hand rather than through
 * toLocaleString: the phone's Intl and node's disagree on small things (a
 * narrow no-break space before "am", "AM" against "am"), and the card has
 * to read the same everywhere.
 */

/** How many rows each list shows, as the mockup's slice(0, 30). */
export const HISTORY_LIST_LIMIT = 30;

export const HISTORY_EMPTY_MESSAGE = 'Nothing here yet.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

export interface HistoryRow {
  key: string;
  title: string;
  sub: string;
  price: string;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "8:59 am", "12:05 pm" — the mockup's en-IN time, lower-case. */
function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

/**
 * "Today, 8:59 am", "Yesterday, 7:24 am", else "15 Oct, 4:24 am" — by the
 * phone's calendar days, not 24-hour spans, so last night at 11 is
 * Yesterday from 12:01. Anything in the future reads as Today, as the
 * mockup's does. An unreadable date is an empty string.
 */
export function formatHistoryWhen(value: unknown, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return '';
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / DAY_MS);
  const time = clockTime(date);
  if (diff <= 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/** 114131 → "1,14,131": the last three digits, then pairs. */
export function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+$)/g, ',')},${tail}`;
}

/**
 * "₹ 82,694": whole rupees, half-up, Indian grouping. The figure is snapped
 * to a millionth of a rupee first, so a float a hair under .50 still rounds
 * up as the price it stands for does. Missing or unreadable is "—".
 */
export function formatHistoryPrice(value: unknown): string {
  const amount = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const snapped = Math.round(amount * 1e6) / 1e6;
  const rounded = snapped < 0 ? -Math.round(-snapped) : Math.round(snapped);
  const sign = rounded < 0 ? '-' : '';
  return `₹ ${sign}${groupIndianDigits(String(Math.abs(rounded)))}`;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * A tag scan (GET /history/scans): the item, then "TAG-10432 · Today, 8:59
 * am", and the price it was last worked out at. A tag the server could not
 * read a code from shows the time alone.
 */
export function scanHistoryRow(raw: unknown, now: Date = new Date()): HistoryRow | null {
  const item = asRecord(raw);
  if (!item) return null;
  const scanId = readString(item, 'scanId');
  const tagCode = readString(item, 'tagCode');
  const when = formatHistoryWhen(item.createdAt, now);
  return {
    key: scanId || `${tagCode}-${readString(item, 'createdAt')}`,
    title: readString(item, 'itemName') || 'Tag scan',
    sub: [tagCode, when].filter(Boolean).join(' · '),
    price: formatHistoryPrice(item.finalMRP),
  };
}

/** A wishlist entry: its name, "Added Today, 7:24 am", and its MRP. */
export function wishlistHistoryRow(
  item: { id: string; title: string; totalMrp: number; addedAt: string },
  now: Date = new Date(),
): HistoryRow {
  const when = formatHistoryWhen(item.addedAt, now);
  return {
    key: item.id,
    title: item.title || 'Wishlist item',
    sub: when ? `Added ${when}` : '',
    price: formatHistoryPrice(item.totalMrp),
  };
}

/**
 * An invoice from GET /invoices: "Cart · 2 items" when the server says how
 * many pieces were billed, "Invoice INV-…" for one issued before it counted
 * them; when it was made; and its grand total.
 */
export function checkoutHistoryRow(raw: unknown, now: Date = new Date()): HistoryRow | null {
  const invoice = asRecord(raw);
  if (!invoice) return null;
  const id = readString(invoice, '_id') || readString(invoice, 'invoiceId');
  const number = readString(invoice, 'invoiceNumber');
  const pieces = Number(invoice.pieceCount);
  const title =
    Number.isInteger(pieces) && pieces > 0
      ? `Cart · ${pieces} ${pieces === 1 ? 'item' : 'items'}`
      : number
        ? `Invoice ${number}`
        : 'Invoice';
  return {
    key: id || number || readString(invoice, 'createdAt'),
    title,
    sub: formatHistoryWhen(invoice.createdAt, now),
    price: formatHistoryPrice(invoice.grandTotal),
  };
}

/** Rows from a list of raw entries, dropping any that cannot be read, at most HISTORY_LIST_LIMIT. */
export function historyRows<T>(
  items: readonly T[],
  toRow: (item: T) => HistoryRow | null,
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const item of items) {
    if (rows.length >= HISTORY_LIST_LIMIT) break;
    const row = toRow(item);
    if (row) rows.push(row);
  }
  return rows;
}
