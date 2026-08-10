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
import { COLLECTIONS, getUserCollection } from './db';
import type { Budget } from '../types';

/**
 * Save or update a budget.
 * We use a deterministic ID based on month and categoryId to easily update existing ones.
 */
export async function saveBudget(userId: string, budget: Omit<Budget, 'id'>): Promise<Budget> {
  const collectionRef = getUserCollection(userId, COLLECTIONS.BUDGETS);
  
  // Create a predictable ID: e.g., '2024-05_total_monthly' or '2024-05_cat123_daily'
  const idSuffix = budget.categoryId ? budget.categoryId : 'total';
  const budgetId = `${budget.month}_${idSuffix}_${budget.period}`;
  
  const docRef = doc(collectionRef, budgetId);
  
  const fullBudget: Budget = {
    ...budget,
    id: budgetId,
  };

  const dataToSave = { ...fullBudget };
  if (dataToSave.categoryId === undefined) {
    delete dataToSave.categoryId;
  }

  await setDoc(docRef, dataToSave);
  return fullBudget;
}

/**
 * Get all budgets for a specific month.
 */
export async function getBudgetsByMonth(userId: string, month: string): Promise<Budget[]> {
  const collectionRef = getUserCollection(userId, COLLECTIONS.BUDGETS);
  const q = query(collectionRef, where('month', '==', month));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Budget);
}

/**
 * Delete a budget.
 */
export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.BUDGETS, budgetId);
  await deleteDoc(docRef);
}

/**
 * Update the order of multiple budgets.
 */
export async function updateBudgetOrders(userId: string, updates: { id: string, order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  
  updates.forEach(({ id, order }) => {
    const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.BUDGETS, id);
    batch.update(docRef, { order });
  });

  await batch.commit();
}
