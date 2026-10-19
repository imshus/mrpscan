/**
 * Pins Masters -> Labour Code as the app reads and uses it (utils/labourCodes.ts):
 *
 *  - a row from GET/POST /labour-codes: its id and code, the rate as a
 *    number (blank is no figure, never zero), the unit one of the three
 *    (per gram when the server sends none or something else);
 *  - codes are matched as the server matches them, on letters and digits
 *    alone ("LB 03" is LB-03);
 *  - picking a code on the review card puts its rate in the Labour Rate box
 *    and its unit with it; a row with no usable figure fills nothing;
 *  - the code the analysis matched is its own field, else its price's;
 *  - a Masters line saves only with a code (at most 20 characters); a rate
 *    may be blank (no figure, as a Wastage %), and a percent rate is at most
 *    100.
 *
 * Run with:  node --test utils/__tests__/labourCodes.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LABOUR_CODE_UNIT,
  LABOUR_CODE_MAX_LENGTH,
  analysisLabourCode,
  cleanLabourCodeRate,
  findLabourCode,
  labourCodeKey,
  labourCodeLineError,
  labourCodeUnitOf,
  labourFromCode,
  toLabourCode,
} from '../labourCodes.ts';

test('a server row: id, code, rate as a number, unit one of the three', () => {
  assert.deepEqual(toLabourCode({ _id: 'a1', code: ' LB-03 ', rate: 415, unit: 'Per Gram' }), {
    id: 'a1',
    code: 'LB-03',
    rate: 415,
    unit: 'Per Gram',
  });
  assert.deepEqual(toLabourCode({ id: 'a2', code: 'LB-07', rate: '4500', unit: 'Per 10 Gram' }), {
    id: 'a2',
    code: 'LB-07',
    rate: 4500,
    unit: 'Per 10 Gram',
  });
  assert.equal(toLabourCode({ id: 'a3', code: 'LB-P', rate: 12, unit: 'Percent' }).unit, 'Percent');
  // Blank is no figure, which is not zero; zero is a figure.
  assert.equal(toLabourCode({ id: 'a4', code: 'LB-0', rate: '' }).rate, null);
  assert.equal(toLabourCode({ id: 'a5', code: 'LB-0', rate: null }).rate, null);
  assert.equal(toLabourCode({ id: 'a6', code: 'LB-0', rate: 0 }).rate, 0);
  assert.equal(toLabourCode({ id: 'a7', code: 'LB-0', rate: 'abc' }).rate, null);
  assert.equal(toLabourCode({ id: 'a8', code: 'LB-0', rate: -5 }).rate, null);
  // No id or no code: not a row.
  assert.equal(toLabourCode({ code: 'LB-01', rate: 350 }), null);
  assert.equal(toLabourCode({ id: 'x', code: '  ', rate: 350 }), null);
  assert.equal(toLabourCode(null), null);
});

test('the unit: any case and spacing of the three; anything else is per gram', () => {
  assert.equal(labourCodeUnitOf('per gram'), 'Per Gram');
  assert.equal(labourCodeUnitOf('PER  10 GRAM'), 'Per 10 Gram');
  assert.equal(labourCodeUnitOf(' percent '), 'Percent');
  for (const other of [undefined, null, '', 'grams', '%', 'Per 100 Gram']) {
    assert.equal(labourCodeUnitOf(other), DEFAULT_LABOUR_CODE_UNIT, String(other));
  }
  assert.equal(DEFAULT_LABOUR_CODE_UNIT, 'Per Gram');
});

test('codes are found on their letters and digits, as the server matches them', () => {
  const codes = [
    toLabourCode({ id: '1', code: 'LB-01', rate: 350 }),
    toLabourCode({ id: '2', code: 'LB-03', rate: 415 }),
  ];
  assert.equal(labourCodeKey('lb - 03'), 'LB03');
  assert.equal(findLabourCode(codes, 'LB-03')?.id, '2');
  assert.equal(findLabourCode(codes, 'lb 03')?.id, '2');
  assert.equal(findLabourCode(codes, 'LB03')?.id, '2');
  assert.equal(findLabourCode(codes, 'LB-02'), null);
  assert.equal(findLabourCode(codes, ''), null);
  assert.equal(findLabourCode(codes, '--'), null);
  assert.equal(findLabourCode([], 'LB-01'), null);
  assert.equal(findLabourCode(null, 'LB-01'), null);
});

test('picking a code fills the Labour Rate with its rate, in its unit', () => {
  assert.deepEqual(labourFromCode({ rate: 415, unit: 'Per Gram' }), {
    labourChargeAmount: '415',
    labourChargeUnit: 'Per Gram',
  });
  assert.deepEqual(labourFromCode({ rate: 4500, unit: 'Per 10 Gram' }), {
    labourChargeAmount: '4500',
    labourChargeUnit: 'Per 10 Gram',
  });
  assert.deepEqual(labourFromCode({ rate: 12.5, unit: 'Percent' }), {
    labourChargeAmount: '12.5',
    labourChargeUnit: 'Percent',
  });
  assert.deepEqual(labourFromCode({ rate: 0, unit: 'Per Gram' }), {
    labourChargeAmount: '0',
    labourChargeUnit: 'Per Gram',
  });
  // Nothing usable: the box keeps what it holds.
  assert.equal(labourFromCode({ rate: null, unit: 'Per Gram' }), null);
  assert.equal(labourFromCode({ rate: 120, unit: 'Percent' }), null);
  assert.equal(labourFromCode(null), null);
  assert.equal(labourFromCode(undefined), null);
});

test('the code the analysis matched: its own field, else the one its price recorded', () => {
  assert.equal(analysisLabourCode({ labourCode: ' LB-03 ' }), 'LB-03');
  assert.equal(analysisLabourCode({ pricing: { breakdown: { labourCode: 'LB-05' } } }), 'LB-05');
  assert.equal(
    analysisLabourCode({ labourCode: 'LB-01', pricing: { breakdown: { labourCode: 'LB-05' } } }),
    'LB-01',
  );
  assert.equal(analysisLabourCode({ labourCode: '', pricing: { breakdown: { labourCode: '' } } }), '');
  assert.equal(analysisLabourCode({ pricing: null }), '');
  assert.equal(analysisLabourCode({ labourCode: 5 }), '');
  assert.equal(analysisLabourCode(null), '');
});

test('a Masters line saves with a code and a rate; a percent rate is at most 100', () => {
  assert.equal(labourCodeLineError('LB-01', '350', 'Per Gram'), null);
  assert.equal(labourCodeLineError('LB-01', '0', 'Per Gram'), null);
  assert.equal(labourCodeLineError('LB-P', '100', 'Percent'), null);
  assert.equal(labourCodeLineError('LB-P', '0', 'Percent'), null);
  assert.equal(labourCodeLineError('LB-P', '12.5', 'Percent'), null);
  assert.equal(labourCodeLineError('LB-10', '4500', 'Per 10 Gram'), null);
  assert.match(labourCodeLineError('  ', '350', 'Per Gram'), /code/i);
  assert.match(labourCodeLineError('X'.repeat(LABOUR_CODE_MAX_LENGTH + 1), '350', 'Per Gram'), /20/);
  assert.equal(labourCodeLineError('X'.repeat(LABOUR_CODE_MAX_LENGTH), '350', 'Per Gram'), null);
  // A blank rate saves, as a blank Wastage % does: the server keeps no figure.
  assert.equal(labourCodeLineError('LB-01', '', 'Per Gram'), null);
  assert.equal(labourCodeLineError('LB-01', '  ', 'Percent'), null);
  assert.match(labourCodeLineError('LB-01', '.', 'Per Gram'), /rate/i);
  assert.match(labourCodeLineError('LB-P', '100.5', 'Percent'), /0 and 100/);
  assert.match(labourCodeLineError('LB-P', '150', 'Percent'), /0 and 100/);
  // Over 100 is fine for rupees.
  assert.equal(labourCodeLineError('LB-05', '600', 'Per Gram'), null);
  assert.equal(LABOUR_CODE_MAX_LENGTH, 20);
});

test('a rate as typed keeps digits and one point', () => {
  assert.equal(cleanLabourCodeRate('415'), '415');
  assert.equal(cleanLabourCodeRate('₹ 4,500'), '4500');
  assert.equal(cleanLabourCodeRate('12.5%'), '12.5');
  assert.equal(cleanLabourCodeRate('1.2.3'), '1.23');
  assert.equal(cleanLabourCodeRate('-5'), '5');
});
