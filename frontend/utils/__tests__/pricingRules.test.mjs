/**
 * Pins the pricing rules the card's request is built with (utils/pricingRules.ts),
 * which must be the server's (backend src/services/pricingInputs.js) for the
 * price the server makes inside the analysis and the card's own to agree:
 *
 *  - a tag's "12%" labour is 12 percent of the gold value, sent as 12 with
 *    unit Percent (it was filed as a labour purity nothing priced, and the
 *    shop's rate went in its place); "MC 850" is Rs 850 a gram; text with no
 *    number is no labour;
 *  - with no labour on the tag the box is filled with the Masters item's
 *    labour in its unit, else the shop's charge (a PERCENTAGE charge as a
 *    percent), on the weight the shop's charge was saved against;
 *  - a stone weight printed in grams is priced as 5 ct a gram, and its unit
 *    is read off the reader's field or the weight's text;
 *  - a colour stone's rate row is its packet's, else its colour and
 *    clarity's on a row without a packet code; a stone with neither keeps
 *    its printed rate.
 *
 * When the backend sits beside this app (the usual checkout) the same inputs
 * are run through the server's own functions and must give the same answers.
 *
 * Run with:  node --test utils/__tests__/pricingRules.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRICING_RULES,
  PRICING_RULES_HEADER,
  caratsOf,
  findColorstoneRateMatch,
  itemLabourOf,
  parseTagLabour,
  prefillLabour,
  readFigure,
  stoneUnitInText,
  stoneWeightUnit,
} from '../pricingRules.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_INPUTS = path.resolve(here, '..', '..', '..', '..', 'backend', 'src', 'services', 'pricingInputs.js');
const server = fs.existsSync(SERVER_INPUTS) ? createRequire(import.meta.url)(SERVER_INPUTS) : null;

const LABOUR_TEXTS = [
  '12%', '12 %', 'LBR 12%', '8.5%', '150%', '850', 'MC 850', 'Making 850', 'Rs. 650', '₹1,250',
  '850 per 10 gram', '850|Per 10 Gram', '12|Percent', '120|Percent', '0|Per Gram', '12', '100', '100.5',
  'NIL', '', '  ', '-500', 'LBR-850', 'Wt.5.43',
];

test('the header this build sends names rules 3', () => {
  // Rules 3: wastage at the Current Gold Rate on the tile's Weight Used, and
  // the rate it was priced at comes back for the invoice's wastage line.
  assert.equal(PRICING_RULES_HEADER, 'X-Pricing-Rules');
  assert.equal(PRICING_RULES, '3');
});

test('a tag\'s labour: "12%" is a percent of the gold, "MC 850" Rs 850/g, a bare figure up to 100 or "NIL" none', () => {
  assert.deepEqual(parseTagLabour('12%'), { amount: 12, unit: 'Percent' });
  assert.deepEqual(parseTagLabour('LBR 12%'), { amount: 12, unit: 'Percent' });
  assert.deepEqual(parseTagLabour('MC 850'), { amount: 850, unit: 'Per Gram' });
  assert.deepEqual(parseTagLabour('850 per 10 gram'), { amount: 850, unit: 'Per 10 Gram' });
  assert.deepEqual(parseTagLabour('850|Per 10 Gram'), { amount: 850, unit: 'Per 10 Gram' });
  assert.deepEqual(parseTagLabour('12|Percent'), { amount: 12, unit: 'Percent' });
  assert.equal(parseTagLabour('150%'), null);
  assert.equal(parseTagLabour('12'), null);
  assert.equal(parseTagLabour('NIL'), null);
  assert.equal(parseTagLabour(''), null);
  assert.equal(readFigure('-500'), 0);
  assert.equal(readFigure('LBR-850'), 850);
});

test('the app reads every labour text exactly as the server does', { skip: !server && 'backend not beside the app' }, () => {
  for (const text of LABOUR_TEXTS) {
    assert.deepEqual(parseTagLabour(text), server.parseTagLabour(text), JSON.stringify(text));
  }
});

test('the labour box: the item\'s labour in its unit first, else the shop\'s charge, on the shop\'s basis', () => {
  const amountShop = { chargeType: 'AMOUNT', value: 500, rupeesUnit: 'Per Gram', weightBasis: 'gross' };
  const percentShop = { chargeType: 'PERCENTAGE', value: 8, weightBasis: 'net' };
  assert.deepEqual(prefillLabour({ labour: 700 }, amountShop), {
    labourChargeAmount: '700', labourChargeUnit: 'Per Gram', labourWeightBasis: 'gross',
  });
  assert.deepEqual(prefillLabour({ labour: 12, labourUnit: 'Percent' }, percentShop), {
    labourChargeAmount: '12', labourChargeUnit: 'Percent', labourWeightBasis: 'net',
  });
  assert.deepEqual(prefillLabour({ labour: 7000, labourUnit: 'Per 10 Gram' }, null), {
    labourChargeAmount: '7000', labourChargeUnit: 'Per 10 Gram', labourWeightBasis: 'net',
  });
  // No item labour: the shop's charge, a PERCENTAGE one as a percent.
  assert.deepEqual(prefillLabour({ labour: null }, amountShop), {
    labourChargeAmount: '500', labourChargeUnit: 'Per Gram', labourWeightBasis: 'gross',
  });
  assert.deepEqual(prefillLabour(null, percentShop), {
    labourChargeAmount: '8', labourChargeUnit: 'Percent', labourWeightBasis: 'net',
  });
  assert.equal(prefillLabour(null, null), null);
  assert.equal(prefillLabour(null, { chargeType: 'NONE', value: 0 }), null);
  // A percent over 100 on an item is no figure.
  assert.equal(itemLabourOf({ labour: 120, labourUnit: 'Percent' }), null);
});

test('the labour box is what the server prices the analysis with', { skip: !server && 'backend not beside the app' }, () => {
  const shops = [
    null,
    { chargeType: 'NONE', value: 0 },
    { chargeType: 'AMOUNT', value: 500, rupeesUnit: 'Per Gram', weightBasis: 'net' },
    { chargeType: 'AMOUNT', value: 5000, rupeesUnit: 'Per 10 Gram', weightBasis: 'gross' },
    { chargeType: 'PERCENTAGE', value: 8, weightBasis: 'gross' },
  ];
  const items = [null, { labour: null }, { labour: 700 }, { labour: 0 }, { labour: 12, labourUnit: 'Percent' }, { labour: 7000, labourUnit: 'Per 10 Gram' }];
  for (const shop of shops) {
    for (const item of items) {
      for (const tag of ['', '12%', 'MC 850', '12', 'NIL']) {
        const fromTag = parseTagLabour(tag);
        const app = fromTag
          ? { labourChargeAmount: String(fromTag.amount), labourChargeUnit: fromTag.unit, labourWeightBasis: 'net' }
          : prefillLabour(item, shop) ?? { labourWeightBasis: 'net' };
        // The rules this build sends: the analysis is priced by them.
        const serverFields = server.appLabourFields({
          tagLabour: tag,
          itemRow: item,
          labourDoc: shop,
          rules: Number(PRICING_RULES),
        });
        assert.deepEqual(app, serverFields, JSON.stringify({ shop, item, tag }));
      }
    }
  }
});

test('a stone weight in grams is 5 ct a gram; its unit comes off the reader or the weight\'s text', () => {
  assert.equal(caratsOf(0.4, 'g'), 2);
  assert.equal(caratsOf(0.4, 'ct'), 0.4);
  assert.equal(caratsOf(0.4, undefined), 0.4);
  assert.equal(stoneUnitInText('0.40 g'), 'g');
  assert.equal(stoneUnitInText('0.40gms'), 'g');
  assert.equal(stoneUnitInText('1.2 cts'), 'ct');
  assert.equal(stoneUnitInText('0.40'), null);
  assert.equal(stoneWeightUnit('0.40', 'g'), 'g');
  assert.equal(stoneWeightUnit('0.40 g', ''), 'g');
  assert.equal(stoneWeightUnit('0.40', ''), 'ct');
});

test('a colour stone\'s row: its packet\'s, else colour and clarity on a non-packet row; blanks keep the printed rate', () => {
  const rows = [
    { packetCode: 'RUBY-A', color: '', clarity: '', rate: 5000 },
    { packetCode: 'EM-B', color: '', clarity: '', rate: 20000 },
    { packetCode: '', color: 'RED', clarity: 'SI', rate: 1200 },
    { packetCode: 'P-RED', color: 'RED', clarity: 'VS', rate: 9999 },
  ];
  assert.equal(findColorstoneRateMatch(rows, { packetCode: 'em-b' })?.rate, 20000);
  assert.equal(findColorstoneRateMatch(rows, { color: 'red', clarity: 'si' })?.rate, 1200);
  // A packet row never answers to colour and clarity, and blanks match nothing.
  assert.equal(findColorstoneRateMatch(rows, { color: 'RED', clarity: 'VS' }), null);
  assert.equal(findColorstoneRateMatch(rows, { color: '', clarity: '' }), null);
  assert.equal(findColorstoneRateMatch(rows, { packetCode: 'NOPE' }), null);
});

test('the colour-stone row is the server\'s for every stone', { skip: !server && 'backend not beside the app' }, () => {
  const rows = [
    { packetCode: 'RUBY-A', color: '', clarity: '', rate: 5000 },
    { packetCode: '', color: 'RED', clarity: 'SI', rate: 1200 },
    { packetCode: '', color: 'BLUE', clarity: '', rate: 800 },
  ];
  for (const stone of [
    { packetCode: 'RUBY-A' }, { packetCode: 'ruby a', color: 'RED', clarity: 'SI' }, { color: 'RED', clarity: 'SI' },
    { color: 'BLUE' }, { color: 'blue', clarity: '' }, { clarity: 'SI' }, {}, { packetCode: 'X', color: 'RED', clarity: 'SI' },
  ]) {
    assert.equal(findColorstoneRateMatch(rows, stone), server.findColorstoneRateMatch(rows, stone), JSON.stringify(stone));
  }
});

test('the labour box: a Labour Code the tag matched comes before the item\'s labour and the shop\'s', () => {
  const amountShop = { chargeType: 'AMOUNT', value: 500, rupeesUnit: 'Per Gram', weightBasis: 'gross' };
  const item = { labour: 700 };
  // The code's rate in its unit, on the shop's basis as any prefill.
  assert.deepEqual(prefillLabour(item, amountShop, 'net', { rate: 415, unit: 'Per Gram' }), {
    labourChargeAmount: '415', labourChargeUnit: 'Per Gram', labourWeightBasis: 'gross',
  });
  assert.deepEqual(prefillLabour(null, null, 'net', { rate: 4500, unit: 'Per 10 Gram' }), {
    labourChargeAmount: '4500', labourChargeUnit: 'Per 10 Gram', labourWeightBasis: 'net',
  });
  assert.deepEqual(prefillLabour(item, null, 'gross', { rate: 12, unit: 'Percent' }), {
    labourChargeAmount: '12', labourChargeUnit: 'Percent', labourWeightBasis: 'gross',
  });
  // A code with no usable figure is passed over: the item's, else the shop's.
  assert.deepEqual(prefillLabour(item, amountShop, 'net', { rate: null, unit: 'Per Gram' }), {
    labourChargeAmount: '700', labourChargeUnit: 'Per Gram', labourWeightBasis: 'gross',
  });
  assert.deepEqual(prefillLabour(null, amountShop, 'net', { rate: 150, unit: 'Percent' }), {
    labourChargeAmount: '500', labourChargeUnit: 'Per Gram', labourWeightBasis: 'gross',
  });
  // No code: exactly as before.
  assert.deepEqual(prefillLabour(item, amountShop, 'net', null), prefillLabour(item, amountShop, 'net'));
  assert.deepEqual(prefillLabour(item, amountShop, 'net', undefined), prefillLabour(item, amountShop, 'net'));
});
