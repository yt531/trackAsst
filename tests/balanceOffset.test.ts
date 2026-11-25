import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcBalanceOffset } from '../lib/balanceOffset.ts';

// WHY：繳款可用個人餘額折抵。折抵不能超過這次要繳的金額（否則多扣），
// 也不能超過繳款人手上的餘額（否則餘額變負數）。

test('餘額足夠時，折抵金額等於繳款金額', () => {
  assert.equal(calcBalanceOffset(200, 500), 200);
});

test('餘額不足時，只能折抵到餘額為止', () => {
  assert.equal(calcBalanceOffset(200, 50), 50);
  assert.equal(calcBalanceOffset(200, 49.99), 49.99);
});

test('沒有餘額、餘額為 0 或負數時，不折抵', () => {
  assert.equal(calcBalanceOffset(200, undefined), 0);
  assert.equal(calcBalanceOffset(200, 0), 0);
  assert.equal(calcBalanceOffset(200, -30), 0);
});

test('繳款金額為空、0、負數或不是數字時，不折抵', () => {
  assert.equal(calcBalanceOffset(0, 500), 0);
  assert.equal(calcBalanceOffset(-10, 500), 0);
  assert.equal(calcBalanceOffset(NaN, 500), 0);
});
