export type SubscriptionStatus =
  | 'NO_LICENSE'
  | 'FREE_TRIAL_LICENSE'
  | 'PERMANENT_LICENSE'
  | 'NO_SUBSCRIPTION'
  | 'FREE_TRIAL'
  | 'PURCHASED'
  | 'EXPIRED';
export type CreditWarningLevel = 'NONE' | 'LOW' | 'CRITICAL' | 'BLOCKED';

export interface SubscriptionOverview {
  status: SubscriptionStatus;
  trialStatus?: 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';
  walletEnabled?: boolean;
  scannerEnabled?: boolean;
  rechargeEnabled?: boolean;
  paymentHistoryEnabled?: boolean;
  trialDays: number;
  trialCredits: number;
  trialStartDate: string | null;
  trialEndDate: string | null;
  trialExpiredAt?: string | null;
  trialDaysRemaining?: number;
  trialHoursRemaining?: number;
  applicationPurchased: boolean;
  purchaseAmount: number;
  purchaseDate: string | null;
  permanentActivatedAt?: string | null;
  purchaseOrderId?: string | null;
  purchasePaymentId?: string | null;
  purchaseInvoiceNumber?: string | null;
  bonusCredits: number;
  creditBalance: number;
  lowCreditThreshold?: number;
  criticalCreditThreshold?: number;
  creditWarningLevel?: CreditWarningLevel;
  todayScans: number;
  monthScans: number;
  todayScanCost?: number;
  currentMonthCost?: number;
  applicationPrice?: number;
  freeTrialCreditsConfigured?: number;
  purchasedBonusCreditsConfigured?: number;
  trialDaysConfigured?: number;
  lastScanCost: number;
  lastScanAt: string | null;
}

export interface ScanBillingRow {
  id?: string;
  scanId: string;
  totalScanCharge: number;
  balanceBefore: number;
  balanceAfter: number;
  billedAt: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  amountInPaise: number;
  currency: string;
  paymentType: 'APPLICATION_PURCHASE' | 'CREDIT_RECHARGE';
  creditsPurchased?: number;
  razorpayKeyId?: string | null;
}

export interface PaymentHistoryRow {
  orderId: string;
  paymentId: string | null;
  invoiceNumber: string | null;
  paymentType: 'APPLICATION_PURCHASE' | 'CREDIT_RECHARGE';
  amount: number;
  gstAmount: number;
  status: string;
  createdAt: string;
}

export interface PaymentHistoryPage {
  records: PaymentHistoryRow[];
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CreditTransactionRow {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string;
  createdAt: string;
}

export interface CreditTransactionPage {
  records: CreditTransactionRow[];
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
