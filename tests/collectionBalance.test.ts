import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paidByPayer, remainingToPay, exceedsRemaining, findOverpaid, findOverpaidWhenLowering } from '../lib/collectionBalance.ts';
import type { Transaction } from '../types';

const tx = (t: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type: 'income',
  amount: 0,
  userId: 'A',
  collectionId: 'C',
  ...t,
} as Transaction);

// WHY：成員不能多繳，也不能把應繳調到比已繳還低，否則會產生溢繳（個人餘額）。
// 待審的繳款也要算進已繳，否則兩筆待審加起來可能超過應繳。

test('已核准與待審的繳款都算在已繳內', () => {
  const paid = paidByPayer([tx({ amount: 60 }), tx({ amount: 30, approvalStatus: 'pending' })], 'C');
  assert.equal(paid.A, 90);
});

test('被退回、已取消的繳款不算已繳', () => {
  const paid = paidByPayer(
    [tx({ amount: 60 }), tx({ amount: 40, approvalStatus: 'rejected' }), tx({ amount: 50, approvalStatus: 'cancelled' })],
    'C',
  );
  assert.equal(paid.A, 60);
});

test('只統計指定的那一期', () => {
  const paid = paidByPayer([tx({ amount: 60, collectionId: 'C' }), tx({ amount: 99, collectionId: 'OTHER' })], 'C');
  assert.equal(paid.A, 60);
});

test('代為送出時，已繳算在被代繳的人（payerId）身上，不是送出的人', () => {
  const paid = paidByPayer([tx({ userId: 'A', payerId: 'B', amount: 100 })], 'C');
  assert.equal(paid.B, 100);
  assert.equal(paid.A, undefined);
});

test('尚欠 = 應繳 − 已繳（含待審），最少為 0', () => {
  const txs = [tx({ amount: 60 }), tx({ amount: 30, approvalStatus: 'pending' })];
  assert.equal(remainingToPay(txs, 'C', 'A', 100), 10);
  assert.equal(remainingToPay(txs, 'C', 'A', 50), 0);   // 已超過也不會是負數
  assert.equal(remainingToPay(txs, 'C', 'B', 100), 100); // 沒繳過的人
});

test('繳款金額超過尚欠就算超過，剛好等於不算', () => {
  assert.equal(exceedsRemaining(10, 10), false);
  assert.equal(exceedsRemaining(10.02, 10), true);
});

test('容許一分錢以內的誤差：總額 100 平均分給 3 人，每人 33.33 + 33.33 + 33.34 都能繳', () => {
  const target = 100 / 3; // 33.3333…
  assert.equal(exceedsRemaining(33.33, target), false);
  assert.equal(exceedsRemaining(33.34, target), false);
});

test('重新分攤：有人已繳超過新的應繳就不允許（會產生溢繳）', () => {
  const txs = [tx({ userId: 'A', amount: 200 }), tx({ userId: 'B', amount: 100 })];
  assert.deepEqual(findOverpaid(txs, 'C', 150), { payerId: 'A', paid: 200 });
  assert.equal(findOverpaid(txs, 'C', 200), null);  // 調成剛好等於最多的人，沒有溢繳
  assert.equal(findOverpaid(txs, 'C', 300), null);  // 調高永遠可以
});

test('重新分攤：待審的繳款核准後也會溢繳，所以一併檢查', () => {
  const txs = [tx({ userId: 'A', amount: 100 }), tx({ userId: 'A', amount: 80, approvalStatus: 'pending' })];
  assert.deepEqual(findOverpaid(txs, 'C', 150), { payerId: 'A', paid: 180 });
});

test('重新分攤只在「調低」應繳時才檢查：金額不變或調高一律允許', () => {
  // 舊資料：A 已繳 250，應繳 200（已經溢繳 50）
  const txs = [tx({ userId: 'A', amount: 250 })];
  assert.equal(findOverpaidWhenLowering(txs, 'C', 200, 200), null);   // 不變：允許（讓舊的溢繳可以被處理）
  assert.equal(findOverpaidWhenLowering(txs, 'C', 200, 300), null);   // 調高：允許
  assert.deepEqual(findOverpaidWhenLowering(txs, 'C', 200, 150), { payerId: 'A', paid: 250 }); // 調低：擋
});

test('調低到剛好等於最多的人已繳的金額是允許的（不會溢繳）', () => {
  const txs = [tx({ userId: 'A', amount: 120 }), tx({ userId: 'B', amount: 80 })];
  assert.equal(findOverpaidWhenLowering(txs, 'C', 200, 120), null);
  assert.deepEqual(findOverpaidWhenLowering(txs, 'C', 200, 119), { payerId: 'A', paid: 120 });
});
