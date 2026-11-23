import { Platform } from 'react-native';

import { apiRequest } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

/**
 * Apple In-App Purchase on the iPhone app (StoreKit 2 through expo-iap).
 * Android keeps Razorpay; expo-iap is not even linked there (package.json
 * autolinking), so nothing here is loaded off iOS.
 *
 * A purchase is granted by the server, never here: the transaction Apple
 * signed goes to /payments/apple/verify, and only once the server has
 * applied it is the transaction finished with Apple. A purchase whose answer
 * was lost stays unfinished, and StoreKit hands it back on the next launch,
 * where the listener sends it again (the server applies each one once).
 *
 * The ids must match the products in App Store Connect and the server's list
 * (backend src/services/appleIap.service.js). `price` is the App Store price
 * to set: credits + 18% GST, as Android charges. The screen shows no price or
 * GST (owner, 23 Nov 2026); Apple's payment sheet shows the amount.
 */
export const APPLE_LICENCE_SKU = 'com.amitaashitsolution.licence';

export const APPLE_CREDIT_PACKS: { sku: string; credits: number; price: number }[] = [
  { sku: 'com.amitaashitsolution.credits50', credits: 50, price: 59 },
  { sku: 'com.amitaashitsolution.credits100', credits: 100, price: 118 },
  { sku: 'com.amitaashitsolution.credits250', credits: 250, price: 295 },
  { sku: 'com.amitaashitsolution.credits500', credits: 500, price: 590 },
  { sku: 'com.amitaashitsolution.credits1000', credits: 1000, price: 1180 },
  { sku: 'com.amitaashitsolution.credits5000', credits: 5000, price: 5900 },
];

const ALL_SKUS = [APPLE_LICENCE_SKU, ...APPLE_CREDIT_PACKS.map((pack) => pack.sku)];

/** True on iPhone, where buying goes through Apple. */
export function canBuyWithApple(): boolean {
  return Platform.OS === 'ios';
}

type IapPurchase = { productId: string; purchaseToken?: string | null; id: string };
type IapModule = typeof import('expo-iap');

let iapModule: IapModule | null = null;
function iap(): IapModule {
  if (!canBuyWithApple()) throw new Error('App Store purchases are only on iPhone.');
  if (!iapModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    iapModule = require('expo-iap') as IapModule;
  }
  return iapModule;
}

export type AppleVerifyResult = {
  idempotent: boolean;
  orderId: string;
  paymentType: 'APPLICATION_PURCHASE' | 'CREDIT_RECHARGE';
  creditsPurchased: number;
  walletBalance: number;
};

async function verifyOnServer(purchase: IapPurchase): Promise<AppleVerifyResult> {
  const signedTransaction = purchase.purchaseToken
    || (await iap().getTransactionJwsIOS(purchase.productId))
    || '';
  const response = await apiRequest<Record<string, unknown>>('/payments/apple/verify', {
    method: 'POST',
    body: { signedTransaction },
  });
  return unwrapApiData(response) as AppleVerifyResult;
}

/** Server first, then finish with Apple: never finished before it is granted. */
async function settle(purchase: IapPurchase): Promise<AppleVerifyResult> {
  const result = await verifyOnServer(purchase);
  await iap().finishTransaction({
    purchase: purchase as never,
    isConsumable: purchase.productId !== APPLE_LICENCE_SKU,
  });
  return result;
}

// One purchase waited on at a time (the screen blocks a second tap).
let pending: {
  sku: string;
  resolve: (result: AppleVerifyResult) => void;
  reject: (error: unknown) => void;
} | null = null;

let connecting: Promise<void> | null = null;

/**
 * Connects to the App Store once, and listens for every transaction from
 * then on: the one just bought, and any left unfinished from before.
 */
export function ensureAppleStore(): Promise<void> {
  if (!connecting) {
    connecting = (async () => {
      const store = iap();
      await store.initConnection();
      store.purchaseUpdatedListener((purchase) => {
        const bought = purchase as unknown as IapPurchase;
        if (!ALL_SKUS.includes(bought.productId)) return;
        const waiting = pending && pending.sku === bought.productId ? pending : null;
        if (waiting) pending = null;
        settle(bought).then(
          (result) => waiting?.resolve(result),
          (error) => {
            if (waiting) waiting.reject(error);
            else console.warn('Could not settle an App Store purchase; it will be retried', error);
          },
        );
      });
      store.purchaseErrorListener((error) => {
        if (!pending) return;
        const waiting = pending;
        pending = null;
        const code = String((error as { code?: unknown })?.code ?? '');
        if (code === 'user-cancelled') {
          waiting.reject(Object.assign(new Error('Payment cancelled.'), { code: 'PAYMENT_CANCELLED' }));
        } else if (code === 'deferred-payment') {
          waiting.reject(new Error('This purchase is waiting for approval. Credits are added once it is approved.'));
        } else {
          waiting.reject(new Error(String((error as { message?: unknown })?.message || 'The App Store purchase did not go through.')));
        }
      });
    })().catch((error) => {
      connecting = null;
      throw error;
    });
  }
  return connecting;
}

/**
 * Buys one product (a credit pack `quantity` times, 1-10) and resolves once
 * the server has granted it.
 */
export async function buyWithApple(sku: string, quantity = 1): Promise<AppleVerifyResult> {
  await ensureAppleStore();
  if (pending) throw new Error('Another purchase is still in progress.');
  const done = new Promise<AppleVerifyResult>((resolve, reject) => {
    pending = { sku, resolve, reject };
  });
  try {
    await iap().requestPurchase({
      request: { apple: quantity > 1 ? { sku, quantity } : { sku } },
      type: 'in-app',
    });
  } catch (error) {
    pending = null;
    throw error;
  }
  return done;
}

/**
 * Restore Purchases (Apple requires it for the licence): the licence bought
 * with this Apple ID is sent to the server again. True when one was found.
 */
export async function restoreApplePurchases(): Promise<boolean> {
  await ensureAppleStore();
  const store = iap();
  await store.restorePurchases();
  const purchases = (await store.getAvailablePurchases()) as unknown as IapPurchase[];
  const licences = purchases.filter((purchase) => purchase.productId === APPLE_LICENCE_SKU);
  for (const licence of licences) await settle(licence);
  return licences.length > 0;
}
