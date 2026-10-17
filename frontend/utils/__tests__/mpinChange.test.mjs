/**
 * Pins MPIN Manager's plain logic (utils/mpinChange.ts): the checks made
 * before anything is sent — one field at a time, top to bottom, in the
 * design's words — how a POST /auth/change-mpin refusal is read, and which
 * field each one is shown under.
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
  readServerRefusal,
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
  // Everything wrong: only the current MPIN is mentioned, in the one line
  // the design has under it.
  assert.deepEqual(validateMpinChange('12', '5', '9'), { current: MPIN_INCORRECT_MESSAGE, next: null, confirm: null });
  assert.deepEqual(validateMpinChange('', '', ''), { current: MPIN_INCORRECT_MESSAGE, next: null, confirm: null });
  assert.deepEqual(validateMpinChange('1234', '567', '567'), { current: null, next: MPIN_INVALID_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinChange('1234', '5678', '5679'), { current: null, next: null, confirm: MPIN_CHANGE_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinChange('1234', '5678', ''), { current: null, next: null, confirm: MPIN_CHANGE_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinChange('1234', '1234', '1234'), { current: null, next: MPIN_SAME_MESSAGE, confirm: null });
  assert.equal(hasMpinChangeError(validateMpinChange('1234', '1234', '1234')), true);
});

test('only digits count', () => {
  assert.equal(validateMpinChange('12a4', '5678', '5678').current, MPIN_INCORRECT_MESSAGE);
  assert.equal(validateMpinChange('1234', '56 8', '56 8').next, MPIN_INVALID_MESSAGE);
});

test('server refusals land under their field; anything else under the button', () => {
  assert.equal(mpinChangeErrorField('MPIN_INCORRECT'), 'current');
  assert.equal(mpinChangeErrorField('MPIN_INVALID'), 'next');
  assert.equal(mpinChangeErrorField('MPIN_SAME'), 'next');
  assert.equal(mpinChangeErrorField('MPIN_MISMATCH'), 'confirm');
  assert.equal(mpinChangeErrorField('MPIN_ATTEMPTS_EXCEEDED'), null);
  assert.equal(mpinChangeErrorField('USER_NOT_FOUND'), null);
  assert.equal(mpinChangeErrorField(null), null);
  assert.equal(mpinChangeErrorField(undefined), null);
});

test("a JSON refusal's code and sentence, each only when it is one", () => {
  // USER_NOT_FOUND comes as a 404: its sentence is what the screen shows.
  assert.deepEqual(readServerRefusal({ success: false, error: 'USER_NOT_FOUND', message: 'This account could not be found.' }), {
    code: 'USER_NOT_FOUND',
    message: 'This account could not be found.',
  });
  assert.deepEqual(
    readServerRefusal({
      success: false,
      error: 'MPIN_ATTEMPTS_EXCEEDED',
      message: 'Too many wrong MPIN attempts. Please try again in 15 minutes.',
    }),
    { code: 'MPIN_ATTEMPTS_EXCEEDED', message: 'Too many wrong MPIN attempts. Please try again in 15 minutes.' },
  );
  // A message that is a bare code is no sentence; an error that is a sentence is no code.
  assert.deepEqual(readServerRefusal({ error: 'SOME_CODE', message: 'SOME_CODE' }), { code: 'SOME_CODE', message: null });
  assert.deepEqual(readServerRefusal({ error: 'Something broke', message: 'Something broke' }), {
    code: null,
    message: 'Something broke',
  });
  // Express's own "Cannot POST" page, a proxy's text, nothing at all.
  assert.deepEqual(readServerRefusal('<!DOCTYPE html><pre>Cannot POST /api/v1/auth/change-mpin</pre>'), { code: null, message: null });
  assert.deepEqual(readServerRefusal(null), { code: null, message: null });
  assert.deepEqual(readServerRefusal({ error: 42, message: '  ' }), { code: null, message: null });
});

test('a known code reads in the design copy; anything else as the server wrote it', () => {
  assert.equal(mpinChangeMessage('MPIN_INCORRECT', 'Wrong'), MPIN_INCORRECT_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_MISMATCH', 'x'), MPIN_CHANGE_MISMATCH_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_INVALID', 'x'), MPIN_INVALID_MESSAGE);
  assert.equal(mpinChangeMessage('MPIN_SAME', 'x'), MPIN_SAME_MESSAGE);
  assert.equal(mpinChangeMessage(null, 'Too many wrong attempts.'), 'Too many wrong attempts.');
});
