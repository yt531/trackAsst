import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFund } from '../lib/fundSummary.ts';
import type { Transaction } from '../types';

// 用最小的假交易組出情境，只填計算會用到的欄位。
const tx = (t: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type: 'income',
  amount: 0,
  userId: 'A',
  ...t,
} as Transaction);

// WHY：成員溢繳的錢另外存在成員個人餘額，不在交易加總裡。
// 可用公積金 = 交易加總；總現金 = 可用公積金 + 成員餘額。曾經多扣一次成員餘額，導致可用公積金偏低。

test('沒有成員餘額時，可用公積金就是收入減支出', () => {
  const r = summarizeFund(
    [tx({ amount: 300 }), tx({ type: 'expense', amount: 80, categoryId: 'c1' })],
    [{ balance: 0 }, {}],
  );
  assert.equal(r.availableBalance, 220);
  assert.equal(r.totalCash, 220);
});

test('重新分攤後（A 多繳的 $100 已從交易扣掉、轉進 A 的餘額）：可用 $200、總現金 $300', () => {
  // A 繳了 200、B 繳了 100，應繳改成 100 → A 的交易被調低成 100，A 的個人餘額 +100
  const r = summarizeFund(
    [tx({ userId: 'A', amount: 100 }), tx({ userId: 'B', amount: 100 })],
    [{ balance: 100 }, { balance: 0 }],
  );
  assert.equal(r.availableBalance, 200);   // 公積金自己的錢，不再被扣第二次
  assert.equal(r.totalMemberBalance, 100);
  assert.equal(r.totalCash, 300);          // 實際現金 = 公積金 + 欠 A 的 100
});

test('用餘額折抵繳款：新增收入、同時扣成員餘額，總現金不變、可用公積金增加折抵的金額', () => {
  const before = summarizeFund([tx({ amount: 100 })], [{ balance: 100 }]);
  // A 用 100 的餘額繳款：新增一筆 100 的收入，A 的餘額變 0
  const after = summarizeFund([tx({ amount: 100 }), tx({ amount: 100 })], [{ balance: 0 }]);
  assert.equal(before.totalCash, 200);
  assert.equal(after.totalCash, 200);                       // 沒有憑空多出現金
  assert.equal(after.availableBalance - before.availableBalance, 100);
});

test('被退回的繳款不計入可用公積金與已繳', () => {
  const r = summarizeFund(
    [tx({ amount: 200, collectionId: 'C' }), tx({ amount: 49.99, collectionId: 'C', approvalStatus: 'rejected' })],
    [],
    'C',
  );
  assert.equal(r.availableBalance, 200);
  assert.equal(r.memberStats.A, 200);
});

test('待審的繳款只列在待審清單，不計入餘額', () => {
  const r = summarizeFund([tx({ amount: 200, approvalStatus: 'pending' })], []);
  assert.equal(r.availableBalance, 0);
  assert.equal(r.pendingApprovals.length, 1);
});

test('代墊未撥款的支出列在待撥款，不扣可用公積金；撥款（settlement）才扣', () => {
  const advance = tx({ type: 'expense', amount: 500, categoryId: 'c', isAdvancePayment: true, advancePaymentStatus: 'unsettled' });
  const r1 = summarizeFund([tx({ amount: 1000 }), advance], []);
  assert.equal(r1.availableBalance, 1000);
  assert.equal(r1.reimbursements.length, 1);
  const r2 = summarizeFund([tx({ amount: 1000 }), tx({ type: 'settlement', amount: 500 })], []);
  assert.equal(r2.availableBalance, 500);
});

test('代為送出的繳款，已繳算在被代繳的人（payerId）身上，不是送出的人', () => {
  const r = summarizeFund([tx({ userId: 'A', payerId: 'B', amount: 100, collectionId: 'C' })], [], 'C');
  assert.equal(r.memberStats.B, 100);
  assert.equal(r.memberStats.A, undefined);
});

test('已繳只統計所選收款期數', () => {
  const r = summarizeFund(
    [tx({ userId: 'A', amount: 100, collectionId: 'C1' }), tx({ userId: 'A', amount: 70, collectionId: 'C2' })],
    [],
    'C2',
  );
  assert.equal(r.memberStats.A, 70);
});
