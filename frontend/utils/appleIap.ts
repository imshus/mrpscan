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
 * These ids are the products approved in App Store Connect on 23 Nov 2026 and
 * must be typed exactly: a product id cannot be renamed once it exists, so
 * the licence really is spelled "lisence". The server's list
 * (backend src/services/appleIap.service.js) must hold the same five.
 *
 * `price` is the rupee price shown while the App Store's own localized price
 * is still loading: a pack costs its credits in rupees, no GST on iPhone
 * (owner, 25 Nov 2026). The licence card reads Rs 15,000 + GST (18%), and the
 * App Store product is priced at the total, Rs 17,700. Apple is the authority
 * on what is actually charged — never present this number as the final price
 * in a storefront other than India.
 */
export const APPLE_LICENCE_SKU = 'com.mrpscan.lisence';

export const APPLE_CREDIT_PACKS: {
  sku: string;
  credits: number;
  price: number;
  /** Badge on the tile, so the four packs read as a ladder. */
  tier: string;
}[] = [
  { sku: 'com.mrpscan.credits.200', credits: 200, price: 200, tier: 'Starter' },
  { sku: 'com.mrpscan.credits.500', credits: 500, price: 500, tier: 'Basic' },
  { sku: 'com.mrpscan.credits.1000', credits: 1000, price: 1000, tier: 'Popular' },
  { sku: 'com.mrpscan.credits.5000', credits: 5000, price: 5000, tier: 'Business' },
];

const ALL_SKUS = [APPLE_LICENCE_SKU, ...APPLE_CREDIT_PACKS.map((pack) => pack.sku)];

/** True on iPhone, where buying goes through Apple. */
export function canBuyWithApple(): boolean {
  return Platform.OS === 'ios';
}

/**
 * What the App Store will actually charge, keyed by product id, already
 * formatted in the shop's own storefront and currency ("₹200", "$2.99").
 *
 * Apple is the authority on price: the rupee figures in APPLE_CREDIT_PACKS
 * are only a stand-in for the moment before this returns, and they are wrong
 * outside India. A product missing from App Store Connect is simply absent
 * here rather than an error, so one bad id cannot hide the rest.
 */
export async function fetchApplePrices(): Promise<Record<string, string>> {
  if (!canBuyWithApple()) return {};
  try {
    await ensureAppleStore();
    const products = (await iap().fetchProducts({
      skus: ALL_SKUS,
      type: 'in-app',
    })) as unknown as { id: string; displayPrice?: string }[];
    const prices: Record<string, string> = {};
    for (const product of products ?? []) {
      if (product?.id && product.displayPrice) prices[product.id] = product.displayPrice;
    }
    return prices;
  } catch {
    // The hardcoded rupee prices stand in; buying still works.
    return {};
  }
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
