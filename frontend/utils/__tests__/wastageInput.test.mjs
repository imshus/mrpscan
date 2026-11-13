/**
 * Pins what the review card's Wastage % box keeps of a keystroke
 * (utils/wastageInput.ts): digits and one decimal point, at most 100, so the
 * box never shows a figure other than the one priced, and never one the
 * server refuses (which blanks the whole card).
 *
 * Run with:  node --test utils/__tests__/wastageInput.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanWastagePercent } from '../wastageInput.ts';

test('digits and one dot pass, anything else is dropped', () => {
  for (const ok of ['', '8', '8.', '8.5', '.5', '0', '100', '99.99']) {
    assert.equal(cleanWastagePercent(ok), ok, ok);
  }
  assert.equal(cleanWastagePercent('8%'), '8');
  assert.equal(cleanWastagePercent(' 8,5'), '85');
});

test('a second dot or a figure over 100 is refused, so the box keeps what it had', () => {
  for (const refused of ['8..5', '8.5.', '1.2.3', '101', '100.5', '150']) {
    assert.equal(cleanWastagePercent(refused), null, refused);
  }
});
