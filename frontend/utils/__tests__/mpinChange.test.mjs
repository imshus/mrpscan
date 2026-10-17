/**
 * Pins MPIN Manager's plain logic (utils/mpinChange.ts): the checks made
 * before anything is sent — one field at a time, top to bottom, in the
 * design's words — and which field each POST /auth/change-mpin refusal is
 * shown under.
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/mpinChange.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MPIN_CHANGE_MISMATCH_MESSAGE,
  MPIN_INCORRECT_MESSAGE,
  MPIN_INVALID_MESSAGE,
  MPIN_SAME_MESSAGE,
  NO_MPIN_CHANGE_ERRORS,
  hasMpinChangeError,
  mpinChangeErrorField,
  mpinChangeMessage,
  validateMpinChange,
} from '../mpinChange.ts';

test('the design copy, word for word', () => {
  assert.equal(MPIN_INCORRECT_MESSAGE, 'Incorrect MPIN.');
  assert.equal(MPIN_INVALID_MESSAGE, 'Enter a 4-digit MPIN');
  assert.equal(MPIN_CHANGE_MISMATCH_MESSAGE, "MPINs don't match");
  assert.equal(MPIN_SAME_MESSAGE, 'Choose an MPIN different from the current one');
});

test('a valid change says nothing', () => {
  const errors = validateMpinChange('1234', '5678', '5678');
  assert.deepEqual(errors, NO_MPIN_CHANGE_ERRORS);
  assert.equal(hasMpinChangeError(errors), false);
});

test('one field at a time, top to bottom', () => {
  // Everything wrong: only the current MPIN is mentioned.
  assert.deepEqual(validateMpinChange('12', '5', '9'), { current: MPIN_INVALID_MESSAGE, next: null, confirm: null });
  assert.deepEqual(validateMpinChange('', '', ''), { current: MPIN_INVALID_MESSAGE, next: null, confirm: null });
  assert.deepEqual(validateMpinChange('1234', '567', '567'), { current: null, next: MPIN_INVALID_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinChange('1234', '5678', '5679'), { current: null, next: null, confirm: MPIN_CHANGE_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinChange('1234', '5678', ''), { current: null, next: null, confirm: MPIN_CHANGE_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinChange('1234', '1234', '1234'), { current: null, next: MPIN_SAME_MESSAGE, confirm: null });
  assert.equal(hasMpinChangeError(validateMpinChange('1234', '1234', '1234')), true);
});

test('only digits count', () => {
  assert.equal(validateMpinChange('12a4', '5678', '5678').current, MPIN_INVALID_MESSAGE);
  assert.equal(validateMpinChange('1234', '56 8', '56 8').next, MPIN_INVALID_MESSAGE);
});

test('server refusals land under their field; anything else under the button', () => {
  assert.equal(mpinChangeErrorField('MPIN_INCORRECT'), 'current');
  assert.equal(mpinChangeErrorField('MPIN_INVALID'), 'next');
  assert.equal(mpinChangeErrorField('MPIN_SAME'), 'next');
  assert.equal(mpinChangeErrorField('MPIN_MISMATCH'), 'confirm');
  assert.equal(mpinChangeErrorField('TOO_MANY_ATTEMPTS'), null);
  assert.equal(mpinChangeErrorField(null), null);
  assert.equal(mpinChangeErrorField(undefined), null);
});

test('a known code reads in the design copy; anything else as the server wrote it', () => {
  assert.equal(mpinChangeMessage('MPIN_INCORRECT', 'Wrong'), MPIN_INCORRECT_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_MISMATCH', 'x'), MPIN_CHANGE_MISMATCH_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_INVALID', 'x'), MPIN_INVALID_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_SAME', 'x'), MPIN_SAME_MESSAGE);
  assert.equal(mpinChangeMessage(null, 'Too many wrong attempts.'), 'Too many wrong attempts.');
});
