/**
 * Pins the iPhone typed-amount recharge (utils/appleCreditPlan.ts): a typed
 * number of credits becomes credit packs x quantity (at most 10 a purchase,
 * at most two purchases), adding up to exactly what was typed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { appleAmountProblem, planAppleCredits, APPLE_MAX_CREDITS } from '../appleCreditPlan.ts';

const total = (plan) => plan.reduce((sum, step) => sum + step.credits * step.quantity, 0);

test('one pack covers the round amounts in one purchase', () => {
  assert.deepEqual(planAppleCredits(50), [{ credits: 50, quantity: 1 }]);
  assert.deepEqual(planAppleCredits(350), [{ credits: 50, quantity: 7 }]);
  assert.deepEqual(planAppleCredits(2000), [{ credits: 500, quantity: 4 }]);
  assert.deepEqual(planAppleCredits(5000), [{ credits: 500, quantity: 10 }]);
});

test('other amounts take two purchases', () => {
  assert.deepEqual(planAppleCredits(2350), [{ credits: 500, quantity: 4 }, { credits: 50, quantity: 7 }]);
  assert.equal(planAppleCredits(4950).length, 2);
  assert.equal(planAppleCredits(5050), null);
});

test('every step of 50 from 50 to the maximum is bought exactly, in at most two purchases', () => {
  for (let amount = 50; amount <= APPLE_MAX_CREDITS; amount += 50) {
    const plan = planAppleCredits(amount);
    assert.ok(plan, `no plan for ${amount}`);
    assert.ok(plan.length <= 2, `${amount} needs ${plan.length} purchases`);
    assert.equal(total(plan), amount);
    for (const step of plan) assert.ok(step.quantity >= 1 && step.quantity <= 10);
  }
});

test('amounts that cannot be bought say why', () => {
  assert.match(appleAmountProblem(0), /enter/);
  assert.match(appleAmountProblem(40), /minimum/);
  assert.match(appleAmountProblem(120), /steps of 50/);
  assert.match(appleAmountProblem(APPLE_MAX_CREDITS + 50), /maximum/);
  assert.equal(planAppleCredits(120), null);
  assert.equal(appleAmountProblem(150), null);
});
