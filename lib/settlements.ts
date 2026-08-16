import { Transaction } from '@/types';

export interface UserBalance {
  userId: string;
  netBalance: number; // >0 means they are owed money, <0 means they owe money
}

export interface SettlementPlan {
  fromUser: string;
  toUser: string;
  amount: number;
}

/**
 * Calculate net balances for each user based on a list of transactions.
 */
export function calculateBalances(transactions: Transaction[]): Record<string, UserBalance> {
  const balances: Record<string, UserBalance> = {};

  const ensureUser = (userId: string) => {
    if (!balances[userId]) {
      balances[userId] = { userId, netBalance: 0 };
    }
  };

  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'settlement') continue;
    
    // The person who paid gets positive credit
    ensureUser(t.userId);
    balances[t.userId].netBalance += t.amount;

    // The people in the splits get negative debt
    if (t.splits && t.splits.length > 0) {
      for (const split of t.splits) {
        ensureUser(split.userId);
        balances[split.userId].netBalance -= split.amount;
      }
    } else {
      // If no splits are defined for some reason, assume the payer paid for themselves
      balances[t.userId].netBalance -= t.amount;
    }
  }

  // Round balances to avoid floating point errors (assuming 2 decimal places for currency)
  for (const userId in balances) {
    balances[userId].netBalance = Math.round(balances[userId].netBalance * 100) / 100;
  }

  return balances;
}

/**
 * Generate a simplified settlement plan using a greedy algorithm.
 */
export function calculateSettlements(balancesRecord: Record<string, UserBalance>): SettlementPlan[] {
  const debtors: UserBalance[] = [];
  const creditors: UserBalance[] = [];

  // Separate into debtors (netBalance < 0) and creditors (netBalance > 0)
  for (const userId in balancesRecord) {
    const bal = balancesRecord[userId].netBalance;
    if (bal < -0.01) {
      debtors.push({ userId, netBalance: bal });
    } else if (bal > 0.01) {
      creditors.push({ userId, netBalance: bal });
    }
  }

  // Sort by amount descending to minimize transactions (largest debts matched with largest credits)
  debtors.sort((a, b) => a.netBalance - b.netBalance); // most negative first
  creditors.sort((a, b) => b.netBalance - a.netBalance); // most positive first

  const plans: SettlementPlan[] = [];
  let d = 0; // debtor index
  let c = 0; // creditor index

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const debt = Math.abs(debtor.netBalance);
    const credit = creditor.netBalance;

    const amount = Math.min(debt, credit);

    if (amount > 0.01) {
      plans.push({
        fromUser: debtor.userId,
        toUser: creditor.userId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    // Update remaining balances
    debtor.netBalance += amount;
    creditor.netBalance -= amount;

    // If a debtor's balance is resolved (close to 0), move to next debtor
    if (Math.abs(debtor.netBalance) < 0.01) {
      d++;
    }
    // If a creditor's balance is resolved, move to next creditor
    if (Math.abs(creditor.netBalance) < 0.01) {
      c++;
    }
  }

  return plans;
}
