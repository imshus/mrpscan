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
 * Whole rupees, half-up. The figure is snapped to a millionth of a rupee
 * first, so a float a hair under .50 still rounds up as the price it stands
 * for does. The tag details page (utils/historyDetails) rounds its tiles'
 * figures with this too.
 */
export function roundRupees(amount: number): number {
  const snapped = Math.round(amount * 1e6) / 1e6;
  return snapped < 0 ? -Math.round(-snapped) : Math.round(snapped);
}

/** "₹ 82,694": whole rupees (roundRupees), Indian grouping. Missing or unreadable is "—". */
export function formatHistoryPrice(value: unknown): string {
  const amount = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const rounded = roundRupees(amount);
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

/* ==================== History pages: one list, a page at a time ====================
 *
 * Settings → History's rows each open a page of their own (Tag scan history,
 * Wishlist history, Checkout history), read from GET /history/scans,
 * /history/wishlist and /history/checkouts a page at a time (utils/historyApi
 * apiFetch*HistoryPage). Their rows look like the ones above and also carry
 * what a tap opens.
 */

/** A row on a history page, with what tapping it opens; '' when the entry carries nothing to open. */
export interface HistoryPageRow extends HistoryRow {
  id: string;
}

/**
 * A tag (GET /history/scans): as scanHistoryRow, opening its scan id. A tag
 * read when scanning began and never priced (status 'read', finalMRP null)
 * shows "—" for its price.
 */
export function scanPageRow(raw: unknown, now: Date = new Date()): HistoryPageRow | null {
  const item = asRecord(raw);
  const row = scanHistoryRow(raw, now);
  if (!item || !row) return null;
  return { ...row, key: readString(item, 'id') || row.key, id: readString(item, 'scanId') };
}

/** A wishlist add (GET /history/wishlist): its name, "Added Today, 7:24 am", and the MRP it was added at. */
export function wishlistPageRow(raw: unknown, now: Date = new Date()): HistoryPageRow | null {
  const item = asRecord(raw);
  if (!item) return null;
  const id = readString(item, 'id');
  const when = formatHistoryWhen(item.createdAt, now);
  return {
    key: id || `${readString(item, 'tagCode')}-${readString(item, 'createdAt')}`,
    id,
    title: readString(item, 'itemName') || 'Wishlist item',
    sub: when ? `Added ${when}` : '',
    price: formatHistoryPrice(item.mrp),
  };
}

/**
 * A checkout (GET /history/checkouts): as checkoutHistoryRow — "Cart · 2
 * items", counted from the pieces listed when pieceCount is missing —
 * opening its invoice id.
 */
export function checkoutPageRow(raw: unknown, now: Date = new Date()): HistoryPageRow | null {
  const invoice = asRecord(raw);
  if (!invoice) return null;
  const counted = Number(invoice.pieceCount);
  const pieceCount =
    Number.isInteger(counted) && counted > 0
      ? counted
      : Array.isArray(invoice.pieces)
        ? invoice.pieces.length
        : 0;
  const row = checkoutHistoryRow({ ...invoice, pieceCount }, now);
  if (!row) return null;
  const id = readString(invoice, 'id');
  return { ...row, key: id || row.key, id };
}

/**
 * The next page under the rows already shown: every entry the page carries
 * that can be read, and none shown already — an entry written while the list
 * was open can push one from the end of a page onto the start of the next.
 */
export function appendHistoryPage(
  shown: readonly HistoryPageRow[],
  items: readonly unknown[],
  toRow: (item: unknown, now: Date) => HistoryPageRow | null,
  now: Date = new Date(),
): HistoryPageRow[] {
  const seen = new Set(shown.map((row) => row.key));
  const rows = [...shown];
  for (const item of items) {
    const row = toRow(item, now);
    if (!row || seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push(row);
  }
  return rows;
}
