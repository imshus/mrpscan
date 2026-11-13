/**
 * Pins what analyzeScan (utils/scanApi.ts) keeps of the server's /analyze
 * answer for the card's labour box: the Masters -> Labour Code the server
 * matched on the tag (top-level labourCode), trimmed, '' when none.
 *
 * The processing screen opens the labour box with that code's rate
 * (labourCodes analysisLabourCode). An analysis that could not price
 * (no live gold rate: pricing null) names the code only at the top level, and
 * the normalized answer used to drop it, so a tag's LB-02 was lost and the
 * box opened with the shop's rate.
 *
 * The app's own file is loaded, not a mirror, through node's type stripping
 * with a resolve hook for the '@/' alias and extensionless imports, and
 * one-line stand-ins for the modules on the way that reach the network, the
 * device or the store (apiClient, imagePicker, mockScanApi, scanMappers,
 * userScopedStorage).
 *
 * Run with:  node --test utils/__tests__/analyzeResponse.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// apiRequest answers through a function the test sets: the server's answer.
const STANDINS = {
  '@/utils/apiClient': [
    'export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }',
    "export const REQUEST_ABORTED_MESSAGE = 'Request aborted';",
    'export function isRequestAbortedError() { return false; }',
    'export function apiRequest(path, options) { return globalThis.__apiRequest(path, options); }',
  ].join('\n'),
  '@/utils/imagePicker': "export function prepareImageForUpload() { throw new Error('no images here'); }",
  '@/utils/mockScanApi': 'export {};',
  '@/utils/scanMappers': 'export function toApiJewelleryType(t) { return t; } export function toApiScanType(t) { return t; }',
  '@/utils/userScopedStorage': 'export function registerScopeResetCallback() {}',
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

delete process.env.EXPO_PUBLIC_USE_MOCK_SCAN;
const { analyzeScan } = await import('@/utils/scanApi');
const { analysisLabourCode } = await import('@/utils/labourCodes');

/** analyzeScan on `data`, wrapped as the server sends it ({ success, data }). */
async function analyzed(data) {
  const asked = [];
  globalThis.__apiRequest = async (requestPath, options) => {
    asked.push({ requestPath, method: options?.method });
    return { success: true, data };
  };
  const { info } = console;
  console.info = () => {};
  let result;
  try {
    result = await analyzeScan('scan-1');
  } finally {
    console.info = info;
  }
  assert.deepEqual(asked, [{ requestPath: '/scans/scan-1/analyze', method: 'POST' }]);
  return result;
}

const ANSWER = {
  scanId: 'scan-1',
  status: 'READY_FOR_REVIEW',
  structuredData: { serialNumber: { value: 'GR10286', confidence: 95 } },
  unknownFields: [],
  tagIdentifiers: ['GR10286', 'LB-02'],
  billing: { billed: false, pending: true },
};

test('an analysis that could not price still names the code the tag carries', async () => {
  const result = await analyzed({
    ...ANSWER,
    pricing: null,
    pricingError: { code: 'RATES_UNAVAILABLE', message: 'Live gold rates are unavailable right now' },
    labourCode: 'LB-02',
  });
  assert.equal(result.pricing, null);
  assert.equal(result.labourCode, 'LB-02');
  // What processing.tsx opens the labour box from.
  assert.equal(analysisLabourCode(result), 'LB-02');
});

test("a priced analysis: the code at the top level, as its price's breakdown records it", async () => {
  const result = await analyzed({
    ...ANSWER,
    pricing: { breakdown: { labourCode: 'LB-02', labourAmount: 3800 }, finalMRP: 141200, finalMRPRounded: 141200 },
    pricingError: null,
    labourCode: 'LB-02',
  });
  assert.equal(result.labourCode, 'LB-02');
  assert.equal(analysisLabourCode(result), 'LB-02');
});

test("the code is trimmed; none, blank or not text is ''", async () => {
  assert.equal((await analyzed({ ...ANSWER, pricing: null, labourCode: '  LB-02 ' })).labourCode, 'LB-02');
  for (const none of [undefined, null, '', '   ', 7, { code: 'LB-02' }]) {
    const result = await analyzed({ ...ANSWER, pricing: null, labourCode: none });
    assert.equal(result.labourCode, '', JSON.stringify(none));
    assert.equal(analysisLabourCode(result), '', JSON.stringify(none));
  }
});
