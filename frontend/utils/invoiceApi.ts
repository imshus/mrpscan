import { apiRequest } from '@/utils/apiClient';

export interface InvoiceLineItemPayload {
  description: string;
  note: string;
  qty: number;
  /**
   * Unit of measure for qty, printed in its own column on the invoice. Without
   * it grams and carats appear as bare numbers in one unlabelled column, and
   * the server cannot tell them apart to total the weight.
   */
  qty_unit: string;
  price: number;
  amount: number;
}

export interface GenerateInvoicePayload {
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  customer_pan: string;
  place_of_supply: string;
  transport: string;
  line_items: InvoiceLineItemPayload[];
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  grand_total: number;
  amount_in_words: string;
  terms_and_conditions: string;
  /** Token reserved for the preview, so the PDF prints that same QR. */
  public_token?: string;
}

export interface GenerateInvoiceResponse {
  invoiceNumber: string;
  invoiceDate: string;
  /** PDFMonkey download link. Signed and short-lived — do not store it. */
  pdfUrl: string;
  /**
   * Stable link served by our own API, backed by the invoice record. This is
   * what the printed QR code points at, and the only URL that still works when
   * an invoice is reopened days later.
   */
  invoiceUrl?: string;
  invoiceId: string;
  /** Data URI of the QR printed on the PDF, so the app shows the same code. */
  qrCodeImage?: string;
}

/** Prefers the durable URL, falling back to the expiring one. */
export function resolveInvoicePdfUrl(invoice: {
  invoiceUrl?: string;
  pdfUrl?: string;
}): string {
  return invoice.invoiceUrl || invoice.pdfUrl || '';
}

/**
 * POST /api/v1/invoices/generate
 * Sends the invoice payload to the backend, which saves it to MongoDB,
 * calls PDFMonkey, and returns the PDF download URL.
 */
export interface ReservedInvoiceQr {
  publicToken: string;
  invoiceUrl: string;
  qrCodeImage: string;
}

/**
 * POST /invoices/reserve-qr — the token and QR image the next invoice will
 * carry.
 *
 * The QR encodes that invoice's download URL, so it cannot be drawn until the
 * token exists. Reserving one up front lets the preview show the very code the
 * PDF will print. Returns null on failure; the preview then shows a
 * placeholder and generation falls back to a fresh token.
 */
export async function reserveInvoiceQr(): Promise<ReservedInvoiceQr | null> {
  try {
    const res = await apiRequest<{ success: boolean; data: ReservedInvoiceQr }>(
      '/invoices/reserve-qr',
      { method: 'POST' },
    );
    return res.success && res.data?.qrCodeImage ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * POST /invoices/preview-html — the invoice rendered from the same template
 * the PDF is made from, so the preview is the document rather than a
 * lookalike. Persists nothing and spends no invoice number.
 */
export async function fetchInvoicePreviewHtml(
  payload: GenerateInvoicePayload & { invoice_number?: string },
): Promise<string | null> {
  try {
    const res = await apiRequest<{ success: boolean; data: { html: string } }>(
      '/invoices/preview-html',
      { method: 'POST', body: payload as unknown as Record<string, unknown> },
    );
    return res.success && res.data?.html ? res.data.html : null;
  } catch {
    return null;
  }
}

export async function apiGenerateInvoice(
  payload: GenerateInvoicePayload,
): Promise<GenerateInvoiceResponse> {
  const res = await apiRequest<{ success: boolean; data: GenerateInvoiceResponse }>(
    '/invoices/generate',
    {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    },
  );
  return res.data;
}

/**
 * GET /api/v1/invoices
 * Returns the list of invoices for the authenticated business.
 */
export async function apiFetchInvoices(): Promise<GenerateInvoiceResponse[]> {
  const res = await apiRequest<{ success: boolean; data: { invoices: GenerateInvoiceResponse[] } }>(
    '/invoices',
  );
  return res.data?.invoices ?? [];
}

/**
 * GET /api/v1/invoices/preview/next-number
 * Returns the next sequence number for the UI preview (e.g. INV-2026-0627-00001)
 */
export async function apiFetchNextInvoiceNumber(): Promise<string> {
  const res = await apiRequest<{ success: boolean; data: { nextNumber: string } }>(
    '/invoices/preview/next-number',
  );
  return res.data?.nextNumber ?? '';
}
