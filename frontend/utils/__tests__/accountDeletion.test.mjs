/**
 * Pins the plain logic behind Delete Account (utils/accountDeletion.ts): the
 * button works only with all six digits and DELETE exactly as written, what
 * the screen tells an owner and an employee, and the server's refusals in
 * words — the code decides before the status, so OTP_NOT_FOUND never reads
 * as "the server does not have this yet", and a 5xx never shows the
 * server's internal text.
 *
 * And the Settings menu itself (utils/settingsAccess.ts): the Delete Account
 * tile sits just above Logout for an owner, a super admin and an employee
 * with no permissions at all.
 *
 * The app's own files are loaded, not a mirror, through node's type
 * stripping (Node 22.18+ / 24), with a resolve hook for the '@/' alias and
 * extensionless imports, and a stand-in for lucide-react-native (the menu
 * only carries its icons).
 *
 * Run with:  node --test utils/__tests__/accountDeletion.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const ICONS = [
  'ClipboardCheck', 'Clock', 'Crown', 'FileText', 'Gift', 'Headset', 'HelpCircle', 'IdCard', 'LayoutGrid',
  'Lock', 'LogOut', 'Sigma', 'Trash2', 'TrendingUp', 'Type', 'UserPlus',
];
const STANDINS = {
  'lucide-react-native': ICONS.map((name) => `export const ${name} = () => null;`).join('\n'),
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

const {
  DELETE_CONFIRM_WORD,
  accountDeletionFailureMessage,
  accountDeletionNote,
  canConfirmAccountDeletion,
  otpSentLine,
} = await import('@/utils/accountDeletion');
const { getVisibleSettingsMenuItems } = await import('@/utils/settingsAccess');

test('enable rule: the whole six-digit code, nothing typed besides', () => {
  // The word the server asks for is still sent, not typed.
  assert.equal(DELETE_CONFIRM_WORD, 'DELETE');
  assert.equal(canConfirmAccountDeletion('123456'), true);

  assert.equal(canConfirmAccountDeletion('12345'), false);
  assert.equal(canConfirmAccountDeletion('1234567'), false);
  assert.equal(canConfirmAccountDeletion('12345a'), false);
  assert.equal(canConfirmAccountDeletion(''), false);
});

test('note: an owner is told the shop stays, an employee only about the login', () => {
  const owner = accountDeletionNote(false);
  const employee = accountDeletionNote(true);
  assert.equal(
    owner,
    "Your login will be removed and you will be signed out. Your shop's records stay saved.",
  );
  assert.equal(employee, 'Your login will be removed and you will be signed out.');
});

test('sent line: the masked number as the server sent it, else a plain line', () => {
  assert.equal(otpSentLine('+91 •••••43210'), 'OTP sent to +91 •••••43210');
  assert.equal(otpSentLine('  +91 •••••43210 '), 'OTP sent to +91 •••••43210');
  assert.equal(otpSentLine(null), 'OTP sent to your registered phone number');
  assert.equal(otpSentLine(''), 'OTP sent to your registered phone number');
});

test('refusals: known codes in words, before the status', () => {
  const fallback = 'Could not delete the account. Please try again.';
  const say = (failure) => accountDeletionFailureMessage(failure, fallback);

  // These routes answer OTP_NOT_FOUND with a 400 ...
  assert.equal(say({ code: 'OTP_NOT_FOUND', status: 400, message: 'Send an OTP to your phone first.' }), 'Send an OTP first, then enter it here.');
  // ... and the general error handler with a 404, which is still not "no route".
  assert.equal(say({ code: 'OTP_NOT_FOUND', status: 404, message: 'No OTP found' }), 'Send an OTP first, then enter it here.');
  assert.match(say({ code: 'OTP_INVALID', status: 400 }), /not correct/);
  assert.match(say({ code: 'OTP_EXPIRED', status: 400 }), /expired/);
  assert.match(say({ code: 'OTP_ALREADY_USED', status: 400 }), /already used/);
  assert.match(say({ code: 'CONFIRMATION_REQUIRED', status: 400 }), /Type DELETE/);
  assert.match(say({ code: 'OTP_SEND_FAILED', status: 502 }), /Couldn't send the OTP/);
});

test("refusals: a rate limit says the server's own wait", () => {
  const fallback = 'Could not send the OTP. Please try again.';
  const say = (failure) => accountDeletionFailureMessage(failure, fallback);

  assert.equal(
    say({ code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Too many codes were sent. Please try again in an hour.' }),
    'Too many codes were sent. Please try again in an hour.',
  );
  assert.equal(
    say({ code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Too many attempts. Please try again in an hour.' }),
    'Too many attempts. Please try again in an hour.',
  );
});

test('refusals: a codeless 404 is an older server; prose passes; a 5xx or a bare code falls back', () => {
  const fallback = 'Could not delete the account. Please try again.';
  const say = (failure) => accountDeletionFailureMessage(failure, fallback);

  assert.match(say({ status: 404, message: 'Route not found' }), /not available on the server yet/);
  assert.equal(say({ status: 409, message: 'This account has no phone number to send an OTP to.' }), 'This account has no phone number to send an OTP to.');
  // The global error handler hands err.message on as it is.
  assert.equal(say({ status: 500, message: 'disk full' }), fallback);
  assert.equal(say({ status: 500, message: 'E11000 duplicate key error collection: pratham.released_logins' }), fallback);
  assert.equal(say({ code: 'OTP_DB_SAVE_FAILED', status: 500, message: 'Failed to persist OTP request.' }), fallback);
  assert.equal(say({ status: 503, message: 'Something broke on our side.' }), fallback);
  assert.equal(say({ code: 'SOME_NEW_CODE', status: 400, message: 'SOME_NEW_CODE' }), fallback);
  assert.equal(say({ message: '' }), fallback);
  assert.equal(say({}), fallback);
});

test('menu: Delete Account sits just above Logout, for owners and employees alike', () => {
  const viewers = [
    ['owner', getVisibleSettingsMenuItems('business', null, false)],
    ['super admin', getVisibleSettingsMenuItems('business', null, true)],
    ['employee with no permissions', getVisibleSettingsMenuItems('employee', null, false)],
  ];
  for (const [who, items] of viewers) {
    const ids = items.map((item) => item.id);
    const del = ids.indexOf('delete-account');
    assert.ok(del >= 0, `${who} sees Delete Account`);
    assert.equal(ids[del + 1], 'logout', `${who}: Logout comes right after it`);
    assert.equal(del, ids.length - 2, `${who}: the two are the last tiles`);
    const tile = items[del];
    assert.equal(tile.isDeleteAccount, true);
    assert.equal(tile.route, '/dashboard/delete-account');
  }
});
