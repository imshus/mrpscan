import type {
  CreditTransactionPage,
  CreditTransactionRow,
  PaymentHistoryPage,
  PaymentHistoryRow,
  PaymentOrderResponse,
  ScanBillingRow,
  SubscriptionOverview,
} from '@/types/subscription';
import { apiRequest, ApiError } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

type ApiEnvelope<T extends Record<string, unknown>> = T & {
  success?: boolean;
  message?: string;
  error?: string;
  data?: T;
};

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function isPaymentCancellation(error: unknown): boolean {
  const raw = error as { code?: unknown; description?: unknown; message?: unknown } | null;
  if (raw?.code === 0 || raw?.code === '0' || raw?.code === 'PAYMENT_CANCELLED') return true;

  const text = `${String(raw?.description ?? '')} ${String(raw?.message ?? '')}`.toLowerCase();
  return text.includes('cancel') || text.includes('dismiss') || text.includes('user closed');
}

export function validateRazorpayPaymentResult(
  result: unknown,
  expectedOrderId: string,
): RazorpayPaymentResult {
  const raw = result && typeof result === 'object'
    ? result as Record<string, unknown>
    : {};
  const paymentId = readString(raw, ['razorpay_payment_id']);
  const orderId = readString(raw, ['razorpay_order_id']);
  const signature = readString(raw, ['razorpay_signature']);

  if (!paymentId || !orderId || !signature) {
    throw new Error('Razorpay did not return a completed payment confirmation.');
  }
  if (orderId !== expectedOrderId) {
    throw new Error('Razorpay payment confirmation does not match this order.');
  }

  return {
    razorpay_payment_id: paymentId,
    razorpay_order_id: orderId,
    razorpay_signature: signature,
  };
}

function unwrapEnvelope<T extends Record<string, unknown>>(response: ApiEnvelope<T>): T {
  return unwrapApiData(response) as T;
}

function isSuccessfulResponse(
  response: ApiEnvelope<Record<string, unknown>>,
  unwrapped: Record<string, unknown>,
): boolean {
  const unwrappedSuccess = unwrapped.success;
  if (typeof unwrappedSuccess === 'boolean') return unwrappedSuccess;
  if (typeof response.success === 'boolean') return response.success;
  return true;
}

function resolveApiMessage(
  response: ApiEnvelope<Record<string, unknown>>,
  unwrapped: Record<string, unknown>,
  fallback: string,
): string {
  return (
    readString(unwrapped, ['message', 'error']) ??
    readString(response as Record<string, unknown>, ['message', 'error']) ??
    fallback
  );
}

function normalizeStatus(raw: unknown): SubscriptionOverview['status'] {
  const value = String(raw || '').trim();
  if (!value) return 'NO_LICENSE';

  if (value === 'NO_SUBSCRIPTION') return 'NO_LICENSE';
  if (value === 'FREE_TRIAL') return 'FREE_TRIAL_LICENSE';
  if (value === 'PURCHASED') return 'PERMANENT_LICENSE';

  return value as SubscriptionOverview['status'];
}

function toOverview(raw: Record<string, unknown>): SubscriptionOverview {
  const status = normalizeStatus(raw.status);

  let trialStatus: SubscriptionOverview['trialStatus'] = 'NOT_STARTED';
  if (status === 'FREE_TRIAL_LICENSE') {
    trialStatus = 'ACTIVE';
  } else if (raw.trialExpiredAt || raw.status === 'EXPIRED') {
    trialStatus = 'EXPIRED';
  }

  return {
    status,
    trialStatus,
    walletEnabled: Boolean(raw.walletEnabled),
    scannerEnabled: Boolean(raw.scannerEnabled),
    rechargeEnabled: Boolean(raw.rechargeEnabled),
    paymentHistoryEnabled: Boolean(raw.paymentHistoryEnabled),
    trialDays: Number(raw.trialDays || 10),
    trialCredits: Number(raw.trialCredits || 100),
    trialStartDate: (raw.trialStartDate as string) || null,
    trialEndDate: (raw.trialEndDate as string) || null,
    trialExpiredAt: (raw.trialExpiredAt as string) || null,
    trialDaysRemaining: Number(raw.trialDaysRemaining || 0),
    trialHoursRemaining: Number(raw.trialHoursRemaining || 0),
    applicationPurchased: status === 'PERMANENT_LICENSE' || Boolean(raw.applicationPurchased),
    purchaseAmount: Number(raw.purchaseAmount || 0),
    purchaseDate: (raw.purchaseDate as string) || null,
    permanentActivatedAt: (raw.permanentActivatedAt as string) || null,
    purchaseOrderId: (raw.purchaseOrderId as string) || null,
    purchasePaymentId: (raw.purchasePaymentId as string) || null,
    purchaseInvoiceNumber: (raw.purchaseInvoiceNumber as string) || null,
    bonusCredits: Number(raw.bonusCredits || 0),
    creditBalance: Number(raw.creditBalance || 0),
    lowCreditThreshold: Number(raw.lowCreditThreshold || 20),
    criticalCreditThreshold: Number(raw.criticalCreditThreshold || 10),
    creditWarningLevel: (raw.creditWarningLevel as SubscriptionOverview['creditWarningLevel']) || 'NONE',
    todayScans: Number(raw.todayScans || 0),
    monthScans: Number(raw.monthScans || 0),
    todayScanCost: Number(raw.todayScanCost || 0),
    currentMonthCost: Number(raw.currentMonthCost || 0),
    applicationPrice: Number(raw.applicationPrice || 12000),
    freeTrialCreditsConfigured: Number(raw.freeTrialCreditsConfigured || 100),
    purchasedBonusCreditsConfigured: Number(raw.purchasedBonusCreditsConfigured || 1000),
    trialDaysConfigured: Number(raw.trialDaysConfigured || 10),
    lastScanCost: Number(raw.lastScanCost || 0),
    lastScanAt: (raw.lastScanAt as string) || null,
  };
}

export async function fetchSubscriptionOverview(): Promise<SubscriptionOverview> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/subscription/overview', {
    method: 'GET',
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to load subscription overview.'));
  }
  return toOverview(unwrapped);
}

export async function startFreeTrial(): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/subscription/trial/start', {
    method: 'POST',
    body: {},
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to start free trial.'));
  }
}

export async function purchaseApplicationPlaceholder(): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/subscription/purchase', {
    method: 'POST',
    body: {},
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to mark application purchase.'));
  }
}

function toPaymentOrder(unwrapped: Record<string, unknown>): PaymentOrderResponse {
  return {
    orderId: String(unwrapped.orderId || ''),
    amount: Number(unwrapped.amount || 0),
    amountInPaise: Number(unwrapped.amountInPaise || 0),
    currency: String(unwrapped.currency || 'INR'),
    paymentType: (unwrapped.paymentType as PaymentOrderResponse['paymentType']) || 'CREDIT_RECHARGE',
    creditsPurchased: unwrapped.creditsPurchased == null ? undefined : Number(unwrapped.creditsPurchased || 0),
    razorpayKeyId: (unwrapped.razorpayKeyId as string) || null,
  };
}

export async function createApplicationPurchaseOrder(): Promise<PaymentOrderResponse> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/payments/orders/application', {
    method: 'POST',
    body: {},
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to create application purchase order.'));
  }
  return toPaymentOrder(unwrapped);
}

export async function createCreditRechargeOrder(amount: number): Promise<PaymentOrderResponse> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/payments/orders/credits', {
    method: 'POST',
    body: { amount },
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to create credit recharge order.'));
  }
  return toPaymentOrder(unwrapped);
}

export async function verifyPayment(orderId: string, paymentId: string, signature: string): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/payments/verify', {
    method: 'POST',
    body: { orderId, paymentId, signature },
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Payment verification failed.'));
  }

  const verifiedStatus = readString(unwrapped, ['status']);
  const verifiedOrderId = readString(unwrapped, ['orderId']);
  const verifiedPaymentId = readString(unwrapped, ['paymentId']);
  if (
    verifiedStatus !== 'PAYMENT_SUCCESS' ||
    verifiedOrderId !== orderId ||
    verifiedPaymentId !== paymentId
  ) {
    throw new Error('Payment has not been captured and verified yet.');
  }
}

export async function markPaymentFailure(orderId: string, paymentId: string | null, reason: string): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>('/payments/mark-failure', {
    method: 'POST',
    body: { orderId, paymentId, reason },
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to record payment failure.'));
  }
}

export async function fetchPaymentHistory(page: number = 1, limit: number = 20): Promise<PaymentHistoryPage> {
  let response: ApiEnvelope<Record<string, unknown>>;
  try {
    response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/payments/history?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' },
    );
  } catch (error) {
    throw error;
  }

  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to load payment history.'));
  }

  const rawRecords = Array.isArray(unwrapped.records)
    ? unwrapped.records
    : Array.isArray(unwrapped)
      ? unwrapped
      : [];

  const records = rawRecords.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      orderId: String(row.orderId || ''),
      paymentId: (row.paymentId as string) || null,
      invoiceNumber: (row.invoiceNumber as string) || null,
      paymentType: (row.paymentType as PaymentHistoryRow['paymentType']) || 'CREDIT_RECHARGE',
      amount: Number(row.amount || 0),
      gstAmount: Number(row.gstAmount || 0),
      status: String(row.status || ''),
      createdAt: String(row.createdAt || ''),
    };
  });

  return {
    records,
    page: Number(unwrapped.page || page || 1),
    limit: Number(unwrapped.limit || limit || 20),
    totalRecords: Number(unwrapped.totalRecords || records.length),
    totalPages: Number(unwrapped.totalPages || 1),
    hasNextPage: Boolean(unwrapped.hasNextPage),
    hasPrevPage: Boolean(unwrapped.hasPrevPage),
  };
}

export async function fetchCreditTransactions(page: number = 1, limit: number = 20): Promise<CreditTransactionPage> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
    `/subscription/credit-transactions?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`,
    { method: 'GET' },
  );
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Failed to load credit transactions.'));
  }

  const recordsRaw = Array.isArray(unwrapped.records) ? unwrapped.records : [];
  const records: CreditTransactionRow[] = recordsRaw.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      id: String(row._id || row.id || ''),
      type: String(row.type || ''),
      amount: Number(row.amount || 0),
      balanceBefore: Number(row.balanceBefore || 0),
      balanceAfter: Number(row.balanceAfter || 0),
      note: String(row.note || ''),
      createdAt: String(row.createdAt || ''),
    };
  });

  return {
    records,
    page: Number(unwrapped.page || page || 1),
    limit: Number(unwrapped.limit || limit || 20),
    totalRecords: Number(unwrapped.totalRecords || records.length),
    totalPages: Number(unwrapped.totalPages || 1),
    hasNextPage: Boolean(unwrapped.hasNextPage),
    hasPrevPage: Boolean(unwrapped.hasPrevPage),
  };
}

async function mutateCredits(path: string, payload: Record<string, unknown>): Promise<void> {
  const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(path, {
    method: 'POST',
    body: payload,
  });
  const unwrapped = unwrapEnvelope(response);
  if (!isSuccessfulResponse(response, unwrapped)) {
    throw new Error(resolveApiMessage(response, unwrapped, 'Credit operation failed.'));
  }
}

export async function addCredits(amount: number): Promise<void> {
  return mutateCredits('/subscription/credits/add', { amount });
}

export async function removeCredits(amount: number): Promise<void> {
  return mutateCredits('/subscription/credits/remove', { amount });
}

export async function setCredits(amount: number): Promise<void> {
  return mutateCredits('/subscription/credits/set', { amount });
}

export async function resetCredits(): Promise<void> {
  return mutateCredits('/subscription/credits/reset', {});
}

export async function fetchScanBilling(limit: number = 20): Promise<ScanBillingRow[]> {
  try {
    const response = await apiRequest<ApiEnvelope<Record<string, unknown>>>(
      `/subscription/scan-billing?limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' },
    );
    const unwrapped = unwrapEnvelope(response);
    if (!isSuccessfulResponse(response, unwrapped)) {
      throw new Error(resolveApiMessage(response, unwrapped, 'Failed to load billing rows.'));
    }

    const rows = Array.isArray(unwrapped) ? unwrapped : (unwrapped.data as unknown[]);
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map((item) => {
      const row = (item || {}) as Record<string, unknown>;
      return {
        scanId: String(row.scanId || ''),
        totalScanCharge: Number(row.totalScanCharge || 0),
        balanceBefore: Number(row.balanceBefore || 0),
        balanceAfter: Number(row.balanceAfter || 0),
        billedAt: String(row.billedAt || row.createdAt || ''),
      };
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Failed to load billing rows.');
  }
}
