/**
 * Pins the iPhone app's "sells nothing" rule (utils/platformCommerce.ts) and
 * that Android is untouched by it.
 *
 * Apple's 3.1.3(f) route for MRPscan on iPhone: no purchasing in the app and
 * no call to action to buy outside it. So on iOS every line the app writes
 * itself for a blocked scan, an ended trial or an empty wallet states the
 * account's position and nothing else; the server's own refusals and
 * reminders ("Please add credits…", "Recharge now…", "Upgrade to a
 * Subscription…") are cut back to the state; and on Android the same calls
 * hand back the server's words exactly as before.
 *
 * The app's own files are loaded as it runs them (type stripping, resolve
 * hook as in goldRateFigures.test.mjs), apiClient included (through node's
 * transform mode, for its constructor parameter fields), with stand-ins for
 * the native modules on its way and a fake fetch. react-native's Platform.OS
 * is read through a getter, so one run checks both platforms.
 *
 * Run with:  node --test utils/__tests__/platformCommerce.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STANDINS = {
  'react-native':
    "export const Platform = { get OS() { return globalThis.__MRPSCAN_TEST_OS__ ?? 'android'; } };",
  '@react-native-async-storage/async-storage': [
    'const store = new Map();',
    'export default {',
    '  getItem: async (key) => (store.has(key) ? store.get(key) : null),',
    '  setItem: async (key, value) => { store.set(key, value); },',
    '  removeItem: async (key) => { store.delete(key); },',
    '  multiRemove: async (keys) => { keys.forEach((key) => store.delete(key)); },',
    '  getAllKeys: async () => [...store.keys()],',
    '};',
  ].join('\n'),
  'expo-constants': 'export default { expoConfig: null, manifest: null, manifest2: null, appOwnership: null };',
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(STANDINS, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(STANDINS[specifier])}`, shortCircuit: true };
    }
    let file = null;
    if (specifier.startsWith('@/')) file = path.join(ROOT, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      file = path.join(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (file === null) return nextResolve(specifier, context);
    if (!path.extname(file)) file = ['.ts', '.tsx'].map((ext) => file + ext).find(existsSync) ?? file;
    const format = file.endsWith('.ts') ? 'module-typescript' : undefined;
    return { url: pathToFileURL(file).href, format, shortCircuit: true };
  },
  // ApiError declares its fields in the constructor's parameters, which
  // type stripping alone refuses; node's transform mode writes them out.
  load(url, context, nextLoad) {
    if (!url.endsWith('/utils/apiClient.ts')) return nextLoad(url, context);
    const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'transform', sourceUrl: url });
    return { format: 'module', source, shortCircuit: true };
  },
});

globalThis.__DEV__ = false;
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

/** apiClient logs every request; the test output does not need it. */
async function quietly(run) {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  try {
    return await run();
  } finally {
    Object.assign(console, { log, error, warn });
  }
}

const commerce = await import('@/utils/platformCommerce');
const {
  ACCOUNT_STATUS_TITLE,
  LICENCE_EXPIRED_LINE,
  LOW_CREDITS_LINE,
  NOT_AVAILABLE_ON_ACCOUNT,
  NO_CREDITS_LINE,
  TRIAL_ENDED_LINE,
  accountStatusLines,
  canPurchaseInApp,
  creditsLine,
  notificationWithoutPurchaseCallToAction,
  purchaseAllowedOn,
  scanBlockedNotice,
  storeSafeServerMessage,
  withoutPurchaseCallToAction,
} = commerce;
const { apiRequest, ApiError } = await quietly(() => import('@/utils/apiClient'));
const { friendlyServerMessage } = await import('@/utils/serverMessages');

function onPlatform(os, run) {
  const before = globalThis.__MRPSCAN_TEST_OS__;
  globalThis.__MRPSCAN_TEST_OS__ = os;
  try {
    return run();
  } finally {
    globalThis.__MRPSCAN_TEST_OS__ = before;
  }
}

async function onPlatformAsync(os, run) {
  const before = globalThis.__MRPSCAN_TEST_OS__;
  globalThis.__MRPSCAN_TEST_OS__ = os;
  try {
    return await run();
  } finally {
    globalThis.__MRPSCAN_TEST_OS__ = before;
  }
}

/**
 * Words that would make a line a call to buy, or point somewhere to pay:
 * Apple's 3.1.3(f) allows none of them in the iPhone app's own wording.
 */
const BUYING_WORDS =
  /purchas|\bbuy|recharg|upgrad|subscri|top.?up|add credits|\bpay\b|payment|price|₹|rupee|razorpay|website|whatsapp|call us|android|play store|\.com/i;

function assertNoBuying(text, where) {
  assert.doesNotMatch(text, BUYING_WORDS, `${where}: "${text}"`);
}

// The server's own words, copied from backend/src/middleware/errorHandler.js
// and backend/src/controllers/notification.controller.js (26 Oct 2026).
const SERVER = {
  NO_CREDITS_AVAILABLE: 'No credits available. Please add credits to continue scanning.',
  TRIAL_EXPIRED: 'Free trial expired. Purchase application to continue scanning.',
  LICENSE_REQUIRED_FOR_CREDITS: 'Your free trial has ended. Purchase the application to add credits.',
  INSUFFICIENT_CREDITS: 'Insufficient credits for this scan.',
};

const plain = (text) => ({ text, bold: false });
const bold = (text) => ({ text, bold: true });

const NOTIFICATIONS = {
  lowCredit: [
    plain('Your credit balance is running low — only '),
    bold('15 credits'),
    plain(' left. Recharge now to keep scanning without interruption.'),
  ],
  trialEnding: [
    plain('Your free trial ends in '),
    bold('2 days'),
    plain('. Upgrade to a Subscription for lifetime access.'),
  ],
  trialEnded: [
    plain('Your free trial has ended. Purchase the '),
    bold('Subscription'),
    plain(' to keep scanning with lifetime access.'),
  ],
  // What already happened: kept word for word on iPhone too.
  licencePurchased: [
    plain('Licence purchased! Your payment of '),
    bold('₹14,160'),
    plain(' via Razorpay is confirmed — lifetime access is active and '),
    bold('1000 bonus credits'),
    plain(' were added to your wallet.'),
  ],
  creditsPurchased: [
    plain('You purchased '),
    bold('500 credits'),
    plain(' for '),
    bold('₹590'),
    plain(' via Razorpay. Happy scanning!'),
  ],
  referralPurchase: [
    plain('Congratulations! '),
    bold('500 credits'),
    plain(' have been credited to your account — '),
    bold('Shree Jewellers'),
    plain(' made a purchase using your referral link. You have '),
    bold('620 credits'),
    plain(' left.'),
  ],
  referralInvite: [
    plain('You earned '),
    bold('50 credits'),
    plain(' — '),
    bold('Shree Jewellers'),
    plain(' installed MRPscan using your invite link. You have '),
    bold('120 credits'),
    plain(' left.'),
  ],
};

const joined = (segments) => segments.map((segment) => segment.text).join('');

test('only the iPhone build is barred from selling', () => {
  assert.equal(purchaseAllowedOn('ios'), false);
  assert.equal(purchaseAllowedOn('android'), true);
  assert.equal(purchaseAllowedOn('web'), true);

  assert.equal(onPlatform('ios', canPurchaseInApp), false);
  assert.equal(onPlatform('android', canPurchaseInApp), true);
});

test('the iPhone wording itself names no purchase, price or place to pay', () => {
  for (const [name, value] of Object.entries(commerce)) {
    if (typeof value === 'string') assertNoBuying(value, name);
  }
  assert.equal(ACCOUNT_STATUS_TITLE, 'Credits & Licence');
});

test('scanner on iPhone: the reason a scan cannot start, and nothing to buy', () => {
  const cases = [
    // Trial over, wallet emptied with it (the usual case).
    [{ trialExpired: true, creditsLow: true, outOfCredits: false, creditBalance: 0 },
      { title: 'Free trial ended', message: `${TRIAL_ENDED_LINE} ${NO_CREDITS_LINE}` }],
    [{ trialExpired: true, creditsLow: false, outOfCredits: false, creditBalance: 40 },
      { title: 'Free trial ended', message: TRIAL_ENDED_LINE }],
    [{ trialExpired: false, creditsLow: true, outOfCredits: true, creditBalance: 0 },
      { title: 'No credits', message: NO_CREDITS_LINE }],
    // 0.51 left: some credit, not a scan's worth.
    [{ trialExpired: false, creditsLow: true, outOfCredits: true, creditBalance: 0.51 },
      { title: 'Low credits', message: LOW_CREDITS_LINE }],
  ];
  for (const [state, expected] of cases) {
    const notice = scanBlockedNotice(state);
    assert.deepEqual(notice, expected);
    // No button: the popup is handed no action and no route.
    assert.deepEqual(Object.keys(notice).sort(), ['message', 'title']);
    assertNoBuying(`${notice.title} ${notice.message}`, 'scanBlockedNotice');
  }
  assert.equal(
    scanBlockedNotice({ trialExpired: false, creditsLow: false, outOfCredits: false, creditBalance: 90 }),
    null,
  );
});

test('Credits & Licence on iPhone: the account as it stands, in plain lines', () => {
  assert.deepEqual(accountStatusLines({ status: 'PERMANENT_LICENSE', creditBalance: 420 }), []);
  assert.deepEqual(accountStatusLines({ status: 'FREE_TRIAL_LICENSE', creditBalance: 8 }), []);
  assert.deepEqual(
    accountStatusLines({ status: 'NO_LICENSE', trialExpiredAt: '2026-10-20T10:00:00Z', creditBalance: 0 }),
    [TRIAL_ENDED_LINE, NO_CREDITS_LINE],
  );
  assert.deepEqual(accountStatusLines({ status: 'EXPIRED', creditBalance: 12 }), [LICENCE_EXPIRED_LINE]);
  assert.deepEqual(
    accountStatusLines({ status: 'PERMANENT_LICENSE', creditBalance: 0.5, minScanBalance: 0.74 }),
    [LOW_CREDITS_LINE],
  );
  // A licence bought after the trial ran out: the old trial is not news.
  assert.deepEqual(
    accountStatusLines({
      status: 'PERMANENT_LICENSE',
      applicationPurchased: true,
      trialExpiredAt: '2026-09-01T00:00:00Z',
      creditBalance: 900,
    }),
    [],
  );
  assert.equal(creditsLine(0), NO_CREDITS_LINE);
  assert.equal(creditsLine(0.3), LOW_CREDITS_LINE);
});

test('buying sentences come out of server text; what happened stays', () => {
  assert.equal(withoutPurchaseCallToAction(SERVER.NO_CREDITS_AVAILABLE), 'No credits available.');
  assert.equal(withoutPurchaseCallToAction(SERVER.TRIAL_EXPIRED), 'Free trial expired.');
  assert.equal(withoutPurchaseCallToAction(SERVER.LICENSE_REQUIRED_FOR_CREDITS), 'Your free trial has ended.');
  assert.equal(withoutPurchaseCallToAction('Recharge now to keep scanning.'), '');
  assert.equal(withoutPurchaseCallToAction(SERVER.INSUFFICIENT_CREDITS), SERVER.INSUFFICIENT_CREDITS);
  assert.equal(withoutPurchaseCallToAction('You purchased 500 credits.'), 'You purchased 500 credits.');
});

test('server refusals on iPhone: by code, by bare code, and anything else untouched', () => {
  assert.equal(storeSafeServerMessage('NO_CREDITS_AVAILABLE', SERVER.NO_CREDITS_AVAILABLE), NO_CREDITS_LINE);
  assert.equal(storeSafeServerMessage('TRIAL_EXPIRED', SERVER.TRIAL_EXPIRED), TRIAL_ENDED_LINE);
  assert.equal(
    storeSafeServerMessage('LICENSE_REQUIRED_FOR_CREDITS', SERVER.LICENSE_REQUIRED_FOR_CREDITS),
    TRIAL_ENDED_LINE,
  );
  // Thrown as bare codes by license.middleware.js, with no sentence of their own.
  for (const code of ['SCANNER_LICENSE_REQUIRED', 'PERMANENT_LICENSE_REQUIRED', 'LICENSE_REQUIRED']) {
    const said = storeSafeServerMessage(code, code);
    assert.notEqual(said, code);
    assertNoBuying(said, code);
  }
  // An unknown code whose words still say "buy": the buying sentence goes.
  assert.equal(storeSafeServerMessage('SOMETHING_NEW', 'Plan over. Please purchase a plan.'), 'Plan over.');
  assert.equal(storeSafeServerMessage(undefined, 'Please recharge to continue.'), NOT_AVAILABLE_ON_ACCOUNT);
  // Everything that is not about buying comes back as the very same string.
  for (const message of ['That MPIN is not correct.', 'Invoice email is not set up yet. Please try again later.', '']) {
    assert.equal(storeSafeServerMessage('X', message), message);
  }
});

test('notifications on iPhone stop at the state; history is kept word for word', () => {
  const lowCredit = notificationWithoutPurchaseCallToAction(NOTIFICATIONS.lowCredit);
  assert.equal(joined(lowCredit), 'Your credit balance is running low — only 15 credits left.');
  assert.deepEqual(lowCredit[1], bold('15 credits'));

  const ending = notificationWithoutPurchaseCallToAction(NOTIFICATIONS.trialEnding);
  assert.equal(joined(ending), 'Your free trial ends in 2 days.');

  const ended = notificationWithoutPurchaseCallToAction(NOTIFICATIONS.trialEnded);
  assert.equal(joined(ended), 'Your free trial has ended.');
  assert.equal(ended.length, 1);

  for (const name of ['licencePurchased', 'creditsPurchased', 'referralPurchase', 'referralInvite']) {
    assert.equal(notificationWithoutPurchaseCallToAction(NOTIFICATIONS[name]), NOTIFICATIONS[name], name);
  }
});

/** One request through the real apiClient, the server refusing with `body`. */
async function refusal(os, status, body) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    return await onPlatformAsync(os, () =>
      quietly(async () => {
        try {
          await apiRequest('/scan/start', { method: 'POST', body: {} });
        } catch (error) {
          return error;
        }
        throw new Error('the request was expected to fail');
      }),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('Android: the server refusal reaches the screen exactly as the server wrote it', async () => {
  for (const [code, message] of Object.entries(SERVER)) {
    const body = { success: false, error: code, message };
    const error = await refusal('android', 402, body);
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, message, code);
    assert.equal(error.status, 402);
    assert.deepEqual(error.body, body);
  }
  // friendlyServerMessage keeps its Android sentences too.
  onPlatform('android', () => {
    assert.equal(
      friendlyServerMessage(new Error('NO_CREDITS_AVAILABLE'), 'x'),
      'Your credits are too low for a scan. Please recharge to continue scanning.',
    );
    assert.equal(
      friendlyServerMessage(new Error('PERMANENT_LICENSE_REQUIRED'), 'x'),
      'This needs lifetime access. Buy the licence to continue.',
    );
  });
});

test('iPhone: the same refusals arrive as the account’s position, status and body intact', async () => {
  const expected = {
    NO_CREDITS_AVAILABLE: NO_CREDITS_LINE,
    TRIAL_EXPIRED: TRIAL_ENDED_LINE,
    LICENSE_REQUIRED_FOR_CREDITS: TRIAL_ENDED_LINE,
    INSUFFICIENT_CREDITS: LOW_CREDITS_LINE,
  };
  for (const [code, message] of Object.entries(SERVER)) {
    const body = { success: false, error: code, message };
    const error = await refusal('ios', 402, body);
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, expected[code], code);
    // processing.tsx still tells a credits refusal by its status.
    assert.equal(error.status, 402);
    assert.deepEqual(error.body, body);
  }
  // Not about buying: untouched on iPhone as well.
  const other = await refusal('ios', 400, { success: false, error: 'BAD', message: 'That MPIN is not correct.' });
  assert.equal(other.message, 'That MPIN is not correct.');

  onPlatform('ios', () => {
    for (const code of ['NO_CREDITS_AVAILABLE', 'PERMANENT_LICENSE_REQUIRED', 'LICENSE_REQUIRED', 'SCANNER_LICENSE_REQUIRED']) {
      assertNoBuying(friendlyServerMessage(new Error(code), 'x'), code);
    }
    // Codes that never spoke of buying keep their Android sentence.
    assert.equal(friendlyServerMessage(new Error('TRIAL_ALREADY_EXPIRED'), 'x'), 'This shop has already used its free trial.');
  });
});
