import { apiRequest } from '@/utils/apiClient';

export interface InvoiceLineItemPayload {
  description: string;
  note: string;
  qty: number;
  price: number;
  amount: number;
}

export interface GenerateInvoicePayload {
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  customer_gstin: string;
  place_of_supply: string;
  transport: string;
  line_items: InvoiceLineItemPayload[];
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  grand_total: number;
  amount_in_words: string;
  terms_and_conditions: string;
}

export interface GenerateInvoiceResponse {
  invoiceNumber: string;
  invoiceDate: string;
  pdfUrl: string;
  invoiceId: string;
}

/**
 * POST /api/v1/invoices/generate
 * Sends the invoice payload to the backend, which saves it to MongoDB,
 * calls PDFMonkey, and returns the PDF download URL.
 */
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
