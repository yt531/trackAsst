import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Budget } from '../types';

/**
 * Save or update a ledger budget.
 */
export async function saveLedgerBudget(ledgerId: string, budget: Omit<Budget, 'id'>): Promise<Budget> {
  const collectionRef = collection(db, 'ledgers', ledgerId, 'budgets');
  
  // Create a predictable ID: e.g., '2024-05_total_monthly' or '2024-05_cat123_daily'
  const idSuffix = budget.categoryId ? budget.categoryId : 'total';
  const budgetId = `${budget.month}_${idSuffix}_${budget.period}`;
  
  const docRef = doc(collectionRef, budgetId);
  
  const fullBudget: Budget = {
    ...budget,
    id: budgetId,
    ledgerId,
  };

  const dataToSave = { ...fullBudget };
  if (dataToSave.categoryId === undefined) {
    delete dataToSave.categoryId;
  }

  await setDoc(docRef, dataToSave);
  return fullBudget;
}

/**
 * Get all budgets for a specific ledger and month.
 */
export async function getLedgerBudgetsByMonth(ledgerId: string, month: string): Promise<Budget[]> {
  const collectionRef = collection(db, 'ledgers', ledgerId, 'budgets');
  
  // If month is a year (e.g. '2024'), this will still work because budget.month will be '2024'
  const q = query(collectionRef, where('month', '==', month));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Budget);
}

/**
 * Delete a ledger budget.
 */
export async function deleteLedgerBudget(ledgerId: string, budgetId: string): Promise<void> {
  const docRef = doc(db, 'ledgers', ledgerId, 'budgets', budgetId);
  await deleteDoc(docRef);
}

/**
 * Update the order of multiple ledger budgets.
 */
export async function updateLedgerBudgetOrders(ledgerId: string, updates: { id: string, order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  
  updates.forEach(({ id, order }) => {
    const docRef = doc(db, 'ledgers', ledgerId, 'budgets', id);
    batch.update(docRef, { order });
  });

  await batch.commit();
}
