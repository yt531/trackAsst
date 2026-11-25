// 繳款時可用個人餘額折抵的金額：不超過繳款金額，也不超過繳款人目前的餘額。
// 核准時（approveTransaction）會再以當下餘額重新檢查一次，所以這裡的結果只是「送出時的預估」。
export const calcBalanceOffset = (amount: number, balance?: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const available = balance && balance > 0 ? balance : 0;
  return Math.min(amount, available);
};
