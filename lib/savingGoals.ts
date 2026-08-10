import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS, getUserCollection } from './db';
import type { SavingGoal } from '../types';
/**
 * Save or update a saving goal.
 */
export async function saveSavingGoal(userId: string, goal: Omit<SavingGoal, 'id' | 'createdAt'>, existingId?: string): Promise<SavingGoal> {
  const collectionRef = getUserCollection(userId, COLLECTIONS.SAVING_GOALS);
  
  const id = existingId || crypto.randomUUID();
  const docRef = doc(collectionRef, id);
  
  const fullGoal: SavingGoal = {
    ...goal,
    id,
    createdAt: existingId ? (goal as any).createdAt || Date.now() : Date.now(),
  };

  await setDoc(docRef, fullGoal);
  return fullGoal;
}

/**
 * Get all saving goals for a user.
 */
export async function getSavingGoals(userId: string): Promise<SavingGoal[]> {
  const collectionRef = getUserCollection(userId, COLLECTIONS.SAVING_GOALS);
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs
    .map(doc => doc.data() as SavingGoal)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return b.createdAt - a.createdAt;
    });
}

/**
 * Update the current amount of a saving goal.
 */
export async function updateSavingGoalAmount(userId: string, goalId: string, addedAmount: number): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  const goalDoc = await getDoc(docRef);
  if (goalDoc.exists()) {
    const data = goalDoc.data() as SavingGoal;
    await setDoc(docRef, { currentAmount: data.currentAmount + addedAmount }, { merge: true });
  }
}

/**
 * Delete a saving goal.
 */
export async function deleteSavingGoal(userId: string, goalId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  await deleteDoc(docRef);
}

/**
 * Update the order of multiple saving goals.
 */
export async function updateSavingGoalsOrder(userId: string, updates: { id: string; order: number }[]): Promise<void> {
  const batch = writeBatch(db);
  
  updates.forEach(({ id, order }) => {
    const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, id);
    batch.set(docRef, { order }, { merge: true });
  });

  await batch.commit();
}

