/**
 * Pins how a tag's karat and its numbers are read (utils/formulaUtils.ts):
 *
 *  - 23K, 21K and 10K, and the fineness marks 958, 875 and 417, read as
 *    those karats, the way the server reads them — they used to fall to the
 *    14K default, and the card and invoice priced a 23K piece at 58.5%;
 *  - a value between two standards is no karat at all (the card then asks);
 *  - the first number in a piece of tag text is the number: a prefix with a
 *    dot ('Rs.', 'Wt.') no longer turns 45,000 into 0.45 or 10.500 into 0.1.
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/formulaUtils.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_FORMULA_KARATS,
  SCANNABLE_KARATS,
  karatFromFineness,
  normalizeKarat,
  parseNumericValue,
  parseWeightValue,
  readScannedKarat,
  resolveScannedKarat,
} from '../formulaUtils.ts';

test('karat: 23K, 21K and 10K are read as printed', () => {
  assert.equal(readScannedKarat('23K', ''), '23K');
  assert.equal(readScannedKarat('21K', ''), '21K');
  assert.equal(readScannedKarat('10K', ''), '10K');
  assert.equal(normalizeKarat('23 KT'), '23K');
  assert.equal(normalizeKarat('21kt'), '21K');
  assert.equal(normalizeKarat('10'), '10K');
});

test('karat: the fineness marks 958, 875 and 417 are 23K, 21K and 10K', () => {
  assert.equal(readScannedKarat('', '958'), '23K');
  assert.equal(readScannedKarat('', '875'), '21K');
  assert.equal(readScannedKarat('', '417'), '10K');
  assert.equal(readScannedKarat('958', ''), '23K');
  assert.equal(karatFromFineness('95.8'), '23K');
  assert.equal(karatFromFineness('87.5'), '21K');
  assert.equal(karatFromFineness('41.7'), '10K');
});

test('karat: the standards that already read keep reading the same', () => {
  assert.equal(readScannedKarat('22K', ''), '22K');
  assert.equal(readScannedKarat('18K', ''), '18K');
  assert.equal(readScannedKarat('', '750'), '18K');
  assert.equal(readScannedKarat('', '91.6'), '22K');
  assert.equal(readScannedKarat('', '585'), '14K');
  assert.equal(readScannedKarat('', '375'), '9K');
  assert.equal(readScannedKarat('', '999'), '24K');
});

test('karat: a value between standards, or none, is not a reading', () => {
  // 937 is 21 per mille from 916 and from 958: neither.
  assert.equal(readScannedKarat('', '937'), '');
  assert.equal(readScannedKarat('', ''), '');
  assert.equal(readScannedKarat('15K', ''), '');
  // Callers that must show something get the 14K default — and can tell it
  // is one, because readScannedKarat said ''.
  assert.equal(resolveScannedKarat('', ''), '14K');
  assert.equal(resolveScannedKarat('', '958'), '23K');
});

test('karat: the dropdown set carries the three new karats; the formula set is unchanged', () => {
  for (const karat of ['23K', '21K', '10K']) {
    assert.ok(SCANNABLE_KARATS.includes(karat), karat);
    assert.equal(ALL_FORMULA_KARATS.includes(karat), false, karat);
  }
  for (const karat of ALL_FORMULA_KARATS) assert.ok(SCANNABLE_KARATS.includes(karat), karat);
  // Every karat the dropdown offers reads back as itself.
  for (const karat of SCANNABLE_KARATS) assert.equal(normalizeKarat(karat), karat);
});

test('numbers: a dotted prefix no longer shrinks the figure', () => {
  assert.equal(parseNumericValue('Rs. 45,000'), 45000);
  assert.equal(parseNumericValue('Wt.10.500'), 10.5);
  assert.equal(parseNumericValue('₹87,500/ct'), 87500);
  assert.equal(parseNumericValue('₹ 1,23,456.78'), 123456.78);
  assert.equal(parseNumericValue('NWT: 8.100 g'), 8.1);
  assert.equal(parseNumericValue('0.64|CODE'), 0.64);
  assert.equal(parseNumericValue('.5 ct'), 0.5);
});

test('numbers: a leading minus is a sign; a hyphen after a word is not', () => {
  assert.equal(parseNumericValue('-500'), -500);
  assert.equal(parseNumericValue('Rs -500'), -500);
  assert.equal(parseNumericValue('LBR-850'), 850);
  assert.equal(parseNumericValue('Wt-10.5'), 10.5);
  // A weight is never below zero.
  assert.equal(parseWeightValue('-2.5'), 0);
  assert.equal(parseWeightValue('Wt.10.500'), 10.5);
});

test('numbers: plain figures, numbers and blanks read as before', () => {
  assert.equal(parseNumericValue('10.500'), 10.5);
  assert.equal(parseNumericValue('1,000'), 1000);
  assert.equal(parseNumericValue(1250.5), 1250.5);
  assert.equal(parseNumericValue(''), 0);
  assert.equal(parseNumericValue('   '), 0);
  assert.equal(parseNumericValue(null), 0);
  assert.equal(parseNumericValue(undefined), 0);
  assert.equal(parseNumericValue('abc'), 0);
  assert.equal(parseNumericValue(Number.NaN), 0);
});
