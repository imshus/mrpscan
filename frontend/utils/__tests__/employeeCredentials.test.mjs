/**
 * Pins the plain logic behind an employee's login: the phone number as the
 * server keys it, the Create/Confirm MPIN check, the message the owner
 * shares, the links the share sheet opens, and what Log In does with each
 * refusal code (utils/employeeCredentials.ts, utils/loginFailure.ts).
 *
 * Both modules have no imports, so node loads the app's own files directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/employeeCredentials.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPLOYEE_MPIN_LENGTH,
  MPIN_MISMATCH_MESSAGE,
  MPIN_REQUIRED_MESSAGE,
  PHONE_TAKEN_MESSAGE,
  buildEmployeeLoginShareMessage,
  formatPhoneForDisplay,
  isMpinPairValid,
  isTenDigitPhone,
  normalizeIndianPhone,
  smsShareUrl,
  validateMpinPair,
  whatsappShareUrls,
} from '../employeeCredentials.ts';
import {
  EMPLOYEE_MPIN_NOT_SET_MESSAGE,
  classifyLoginFailure,
} from '../loginFailure.ts';

test('phone: formatting and a leading +91 or 0 fall away', () => {
  assert.equal(normalizeIndianPhone('9876512340'), '9876512340');
  assert.equal(normalizeIndianPhone('98765 12340'), '9876512340');
  assert.equal(normalizeIndianPhone('+91 98765-12340'), '9876512340');
  assert.equal(normalizeIndianPhone('919876512340'), '9876512340');
  assert.equal(normalizeIndianPhone('09876512340'), '9876512340');
  assert.equal(normalizeIndianPhone(''), '');
  assert.equal(normalizeIndianPhone(undefined), '');
  assert.equal(normalizeIndianPhone(null), '');
});

test('phone: a number that is not ten digits is never trimmed into another one', () => {
  assert.equal(normalizeIndianPhone('12345'), '12345');
  assert.equal(normalizeIndianPhone('123456789012345'), '123456789012345');
  assert.equal(isTenDigitPhone('12345'), false);
  assert.equal(isTenDigitPhone('123456789012345'), false);
  assert.equal(isTenDigitPhone('9876512340'), true);
  assert.equal(isTenDigitPhone('+91 98765 12340'), true);
});

test('phone: printed as "+91 <ten digits>", a dash when there is none', () => {
  assert.equal(formatPhoneForDisplay('9876512340'), '+91 9876512340');
  assert.equal(formatPhoneForDisplay('+919876512340'), '+91 9876512340');
  assert.equal(formatPhoneForDisplay(''), '—');
  assert.equal(formatPhoneForDisplay('98765'), '—');
});

test('MPIN: four digits first, then the confirmation must match', () => {
  assert.equal(EMPLOYEE_MPIN_LENGTH, 4);
  assert.deepEqual(validateMpinPair('', ''), { mpin: MPIN_REQUIRED_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinPair('123', '123'), { mpin: MPIN_REQUIRED_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinPair('12a4', '12a4'), { mpin: MPIN_REQUIRED_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinPair('12345', '12345'), { mpin: MPIN_REQUIRED_MESSAGE, confirm: null });
  assert.deepEqual(validateMpinPair('1234', ''), { mpin: null, confirm: MPIN_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinPair('1234', '1243'), { mpin: null, confirm: MPIN_MISMATCH_MESSAGE });
  assert.deepEqual(validateMpinPair('0420', '0420'), { mpin: null, confirm: null });
  assert.equal(isMpinPairValid('0420', '0420'), true);
  assert.equal(isMpinPairValid('0420', '0421'), false);
});

test('MPIN: the copy matches the owner screens', () => {
  assert.equal(MPIN_REQUIRED_MESSAGE, 'Enter a 4-digit MPIN');
  assert.equal(MPIN_MISMATCH_MESSAGE, "MPINs don't match");
  assert.equal(PHONE_TAKEN_MESSAGE, 'This number is already registered');
});

test('share message: word for word as the mockup', () => {
  assert.equal(
    buildEmployeeLoginShareMessage('9876512340', '4821'),
    'Your MRPscan login — Phone: +91 9876512340, MPIN: 4821. Sign in with your phone number, OTP and this MPIN.',
  );
});

test('share links: WhatsApp app with a web fallback, SMS per platform', () => {
  const message = 'Your MRPscan login — Phone: +91 9876512340, MPIN: 4821. Sign in & go?';
  const encoded = encodeURIComponent(message);
  const wa = whatsappShareUrls(message);
  assert.equal(wa.app, `whatsapp://send?text=${encoded}`);
  assert.equal(wa.web, `https://wa.me/?text=${encoded}`);
  // The ampersand and question mark in the text must not end the parameter.
  assert.ok(!wa.app.slice('whatsapp://send?text='.length).includes('&'));
  assert.equal(smsShareUrl(message, 'android'), `sms:?body=${encoded}`);
  assert.equal(smsShareUrl(message, 'ios'), `sms:&body=${encoded}`);
  assert.equal(decodeURIComponent(smsShareUrl(message, 'android').slice('sms:?body='.length)), message);
});

test('login refusals: each code goes where it should', () => {
  assert.equal(classifyLoginFailure('MPIN_NOT_SET'), 'owner-mpin-not-set');
  // Never the owner's set-MPIN screen for an employee.
  assert.equal(classifyLoginFailure('EMPLOYEE_MPIN_NOT_SET'), 'employee-mpin-not-set');
  assert.equal(classifyLoginFailure('INVALID_PHONE_CREDENTIALS'), 'wrong-credentials');
  assert.equal(classifyLoginFailure('INVALID_MPIN'), 'wrong-credentials');
  assert.equal(classifyLoginFailure(undefined), 'wrong-credentials');
  assert.equal(classifyLoginFailure(''), 'wrong-credentials');
  assert.equal(classifyLoginFailure('EMPLOYEE_INACTIVE'), 'refused');
  assert.equal(classifyLoginFailure('ACCOUNT_NOT_FOUND'), 'refused');
  assert.equal(EMPLOYEE_MPIN_NOT_SET_MESSAGE, 'Ask your shop owner to set your MPIN');
});
