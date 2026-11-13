/**
 * Pins the MRP request the card and the processing screen's prefetch build
 * from the scan (utils/pricingPrefetch.ts) for the wastage's weight:
 *
 *  - every request says which weight the wastage percent is taken of, net
 *    unless the Wastage tile picked gross, and never anything else (the
 *    server refuses any other value);
 *  - a first price prefetched for one weight is never handed to the card
 *    asking for the other: the prefetch is matched on the whole payload.
 *
 * The app's own file is loaded, not a mirror, through node's type stripping
 * with a resolve hook for the '@/' alias and extensionless imports, and
 * one-line stand-ins for the three modules on the way that reach the network
 * or the store (scanApi, userScopedStorage, scannerStore).
 *
 * Run with:  node --test utils/__tests__/pricingPrefetch.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// calculateScanMrp answers through a function the test sets, so each case
// can count the requests and settle them.
const STANDINS = {
  '@/utils/scanApi':
    'export function calculateScanMrp(scanId, payload) { return globalThis.__calculateScanMrp(scanId, payload); }',
  '@/utils/userScopedStorage': 'export function registerScopeResetCallback() {}',
  '@/store/scannerStore': 'export const useScannerStore = { getState: () => ({ tagIdentifiers: [] }) };',
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
});

const { derivePricingInput, prefetchFirstPricing, takePrefetchedPricing } = await import('@/utils/pricingPrefetch');
const { DEFAULT_SCAN_ITEM } = await import('@/constants/scannerData');

/** A plain 22K piece: 10 g net, 10.6 g gross, wastage 8%. */
const scan = (overrides = {}) => ({
  ...DEFAULT_SCAN_ITEM,
  karat: '22K',
  netWt: '10',
  grossWt: '10.6',
  wastagePercent: '8',
  ...overrides,
});

const payloadFor = (scanData) => derivePricingInput('Gold', scanData, {}, '22K').payload;

test('a new scan prices its wastage on the net weight', () => {
  assert.equal(DEFAULT_SCAN_ITEM.wastageWeightBasis, 'net');
  assert.equal(payloadFor(scan()).wastageWeightBasis, 'net');
});

test('the Wastage tile\'s Gross wt goes in the request', () => {
  const payload = payloadFor(scan({ wastageWeightBasis: 'gross' }));
  assert.equal(payload.wastageWeightBasis, 'gross');
  // The rest of the request is untouched by the choice.
  assert.equal(payload.wastagePercent, 8);
  assert.equal(payload.netWt, 10);
  assert.equal(payload.grossWt, 10.6);
});

test('a scan from before the choice, or a stray value, is priced on the net weight', () => {
  assert.equal(payloadFor(scan({ wastageWeightBasis: undefined })).wastageWeightBasis, 'net');
  assert.equal(payloadFor(scan({ wastageWeightBasis: 'Gross' })).wastageWeightBasis, 'net');
  assert.equal(payloadFor(scan({ wastageWeightBasis: '' })).wastageWeightBasis, 'net');
});

test('a price prefetched on the net weight is never handed to a request on the gross', () => {
  const requests = [];
  globalThis.__calculateScanMrp = (scanId, payload) => {
    requests.push({ scanId, payload });
    return Promise.resolve({ breakdown: {}, finalMRP: 1 });
  };

  const net = derivePricingInput('Gold', scan(), {}, '22K');
  prefetchFirstPricing('scan-net-then-gross', net);
  assert.equal(requests.length, 1);

  // The shop picked Gross wt before the card's first request: no match.
  const gross = payloadFor(scan({ wastageWeightBasis: 'gross' }));
  assert.equal(takePrefetchedPricing('scan-net-then-gross', gross), null);

  // The same inputs still match (and the entry is handed over once).
  assert.ok(takePrefetchedPricing('scan-net-then-gross', payloadFor(scan())));
  assert.equal(takePrefetchedPricing('scan-net-then-gross', payloadFor(scan())), null);
});

test('a price prefetched on the gross weight matches only the gross request', () => {
  globalThis.__calculateScanMrp = () => Promise.resolve({ breakdown: {}, finalMRP: 1 });

  const gross = derivePricingInput('Gold', scan({ wastageWeightBasis: 'gross' }), {}, '22K');
  prefetchFirstPricing('scan-gross', gross);
  assert.equal(takePrefetchedPricing('scan-gross', payloadFor(scan())), null);
  assert.ok(takePrefetchedPricing('scan-gross', payloadFor(scan({ wastageWeightBasis: 'gross' }))));
});

test('Wastage %: only a typed figure is sent; an empty box or a lone dot keeps the item\'s', () => {
  assert.equal(payloadFor(scan({ wastagePercent: '8.5' })).wastagePercent, 8.5);
  assert.equal(payloadFor(scan({ wastagePercent: '.5' })).wastagePercent, 0.5);
  assert.equal(payloadFor(scan({ wastagePercent: '0' })).wastagePercent, 0);
  for (const blank of ['', ' ', '.', undefined]) {
    assert.equal('wastagePercent' in payloadFor(scan({ wastagePercent: blank })), false, JSON.stringify(blank));
  }
});

test('the Wastage Code picked on the card is sent, trimmed; none picked sends none', () => {
  assert.equal(payloadFor(scan({ wastageCode: ' W10 ' })).wastageCode, 'W10');
  assert.equal('wastageCode' in payloadFor(scan({ wastageCode: '' })), false);
  assert.equal('wastageCode' in payloadFor(scan({ wastageCode: undefined })), false);
});

test('the Labour Code picked on the card is sent, trimmed; none picked sends none', () => {
  assert.equal(payloadFor(scan({ labourCode: ' LB-03 ' })).labourCode, 'LB-03');
  assert.equal('labourCode' in payloadFor(scan({ labourCode: '' })), false);
  assert.equal('labourCode' in payloadFor(scan({ labourCode: '  ' })), false);
  assert.equal('labourCode' in payloadFor(scan({ labourCode: undefined })), false);
  // Picking it filled the Labour Rate with the code's rate: both go, and the
  // figure (which the server charges ahead of the code's) is the box's.
  const picked = payloadFor(
    scan({ labourCode: 'LB-03', labourChargeAmount: '415', labourChargeUnit: 'Per Gram' }),
  );
  assert.equal(picked.labourCode, 'LB-03');
  assert.equal(picked.labourChargeAmount, '415');
  assert.equal(picked.labourChargeUnit, 'Per Gram');
});

test('a price prefetched before a Labour Code was picked is not handed to the request after', () => {
  globalThis.__calculateScanMrp = () => Promise.resolve({ breakdown: {}, finalMRP: 1 });

  prefetchFirstPricing('scan-labour-code', derivePricingInput('Gold', scan(), {}, '22K'));
  assert.equal(takePrefetchedPricing('scan-labour-code', payloadFor(scan({ labourCode: 'LB-03' }))), null);
  assert.ok(takePrefetchedPricing('scan-labour-code', payloadFor(scan())));
});
