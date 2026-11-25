import type { Transaction, LedgerMember } from '../types';
import { isIncomeCounted } from './approval.ts';

// 公積金儀表板的金額統計（純函式，方便測試）。
//
// 記帳模型：
// - 交易（收入、支出、撥款）加總出的是「公積金本身的錢」＝可用公積金，不含成員溢繳。
// - 成員溢繳的錢另外存放在各成員的個人餘額（member.balance）。
//   重新分攤時，繳款交易會被調低、同時把溢繳記進成員餘額；用餘額折抵時，則新增收入交易、
//   同時扣掉成員餘額。也就是錢在「公積金」與「成員餘額」之間移動，兩邊各自一份，不重複。
// - 因此：可用公積金 = 交易加總；總現金 = 可用公積金 + 所有成員餘額。
export function summarizeFund(
  transactions: Transaction[],
  members: Pick<LedgerMember, 'balance'>[],
  selectedCollectionId?: string
) {
  let balance = 0;
  let spent = 0;
  const reimbursements: Transaction[] = [];
  const pendingApprovals: Transaction[] = [];
  const categoryTotals: Record<string, number> = {};
  const memberStats: Record<string, number> = {}; // 所選收款期數中，各成員的已繳金額

  transactions.forEach(tx => {
    if (tx.type === 'income') {
      if (tx.approvalStatus === 'pending') {
        pendingApprovals.push(tx);
      } else if (isIncomeCounted(tx.approvalStatus)) {
        // 被退回（rejected）、已取消（cancelled）的收入不算進餘額與已繳金額
        balance += tx.amount;
        if (tx.collectionId === selectedCollectionId) {
          // 繳款人以 payerId 為準（代為送出時是被代繳的人），沒有就用送出者
          const payer = tx.payerId || tx.userId;
          memberStats[payer] = (memberStats[payer] || 0) + tx.amount;
        }
      }
    } else if (tx.type === 'expense') {
      const isReimbursement = tx.isAdvancePayment && tx.advancePaymentStatus === 'unsettled';

      if (isReimbursement) {
        reimbursements.push(tx);
      } else {
        balance -= tx.amount;
        spent += tx.amount;
        categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + tx.amount;
      }
    } else if (tx.type === 'settlement') {
      balance -= tx.amount;
    }
  });

  const categoryData = Object.keys(categoryTotals)
    .map(catId => ({ name: catId, value: categoryTotals[catId] }))
    .sort((a, b) => b.value - a.value);

  const totalMemberBalance = members.reduce((sum, m) => sum + (m.balance || 0), 0);

  return {
    availableBalance: balance,
    totalMemberBalance,
    totalCash: balance + totalMemberBalance,
    totalSpent: spent,
    reimbursements,
    pendingApprovals,
    categoryData,
    memberStats
  };
}
