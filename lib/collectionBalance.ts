import type { Transaction } from '../types';

// 公積金某一期收款的「已繳／尚欠」計算（純函式）。
// 政策：成員不能多繳，也不能把應繳金額調到比任何人已繳的還低，所以不會產生溢繳。

const EPSILON = 0.01; // 容許一分錢以內的誤差（總額平均分攤可能除不盡，例如 100 ÷ 3）

const round2 = (n: number) => Math.round(n * 100) / 100;

// 已核准、待審、等待刪除審核與沒有狀態的舊資料，都算在這一期的「已繳或待審」內；
// 被退回、已取消的不算。把待審也算進去，才不會讓兩筆待審加起來超過應繳。
const countsTowardCollection = (tx: Transaction) =>
  tx.type === 'income' && tx.approvalStatus !== 'rejected' && tx.approvalStatus !== 'cancelled';

// 某一期各繳款人的已繳（含待審）金額。繳款人以 payerId 為準（代為送出時是被代繳的人），沒有就用送出者。
export function paidByPayer(transactions: Transaction[], collectionId: string): Record<string, number> {
  const paid: Record<string, number> = {};
  transactions.forEach(tx => {
    if (tx.collectionId !== collectionId || !countsTowardCollection(tx)) return;
    const payer = tx.payerId || tx.userId;
    paid[payer] = (paid[payer] || 0) + tx.amount;
  });
  return paid;
}

// 某位繳款人在某一期還能繳多少（應繳 − 已繳含待審），最少為 0。
export function remainingToPay(
  transactions: Transaction[],
  collectionId: string,
  payerId: string,
  targetAmount: number
): number {
  const paid = paidByPayer(transactions, collectionId)[payerId] || 0;
  return Math.max(0, round2(targetAmount - paid));
}

// 這次繳款是否超過還能繳的金額（容許一分錢以內的誤差）。
export const exceedsRemaining = (amount: number, remaining: number): boolean => amount > remaining + EPSILON;

// 把某一期的應繳金額調成 newTarget 時，是否有人已繳（含待審）的金額超過它；有的話會產生溢繳，不允許。
export function findOverpaid(
  transactions: Transaction[],
  collectionId: string,
  newTarget: number
): { payerId: string; paid: number } | null {
  const paid = paidByPayer(transactions, collectionId);
  for (const [payerId, amount] of Object.entries(paid)) {
    if (amount > newTarget + EPSILON) return { payerId, paid: round2(amount) };
  }
  return null;
}

// 重新分攤時的限制：只有「調低」應繳金額才檢查是否有人已繳超過。
// 沒有調低（金額不變或調高）不會因為這次操作產生新的溢繳，所以允許；
// 這也讓舊資料裡已經存在的溢繳，仍可以用重新分攤處理。
export function findOverpaidWhenLowering(
  transactions: Transaction[],
  collectionId: string,
  currentTarget: number,
  newTarget: number
): { payerId: string; paid: number } | null {
  if (newTarget >= currentTarget - EPSILON) return null;
  return findOverpaid(transactions, collectionId, newTarget);
}
