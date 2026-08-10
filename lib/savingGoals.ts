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
import type { SavingGoal, SavingRecord } from '../types';
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
 * Get a specific saving goal.
 */
export async function getSavingGoal(userId: string, goalId: string): Promise<SavingGoal | null> {
  const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as SavingGoal) : null;
}

/**
 * Update the current amount of a saving goal and add a record.
 */
export async function updateSavingGoalAmount(userId: string, goalId: string, addedAmount: number, note?: string, date?: number): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  const goalDoc = await getDoc(docRef);
  if (goalDoc.exists()) {
    const data = goalDoc.data() as SavingGoal;
    
    const batch = writeBatch(db);
    batch.set(docRef, { currentAmount: data.currentAmount + addedAmount }, { merge: true });

    const recordRef = doc(collection(docRef, 'records'));
    const recordData: any = {
      id: recordRef.id,
      amount: addedAmount,
      date: date || Date.now(),
    };
    if (note) {
      recordData.note = note;
    }
    
    batch.set(recordRef, recordData);

    await batch.commit();
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

/**
 * Get records for a saving goal.
 */
export async function getSavingRecords(userId: string, goalId: string): Promise<SavingRecord[]> {
  const recordsRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId, 'records');
  const snapshot = await getDocs(recordsRef);
  return snapshot.docs
    .map(doc => doc.data() as SavingRecord)
    .sort((a, b) => b.date - a.date);
}

/**
 * Delete a saving record and update goal's current amount.
 */
export async function deleteSavingRecord(userId: string, goalId: string, recordId: string, amountToDeduct: number): Promise<void> {
  const goalRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  const recordRef = doc(collection(goalRef, 'records'), recordId);
  
  const goalDoc = await getDoc(goalRef);
  if (goalDoc.exists()) {
    const data = goalDoc.data() as SavingGoal;
    const batch = writeBatch(db);
    
    // Decrement the goal amount
    batch.set(goalRef, { currentAmount: Math.max(0, data.currentAmount - amountToDeduct) }, { merge: true });
    // Delete the record
    batch.delete(recordRef);

    await batch.commit();
  }
}

/**
 * Update a saving record and adjust goal's current amount.
 */
export async function updateSavingRecord(
  userId: string, 
  goalId: string, 
  recordId: string, 
  oldAmount: number, 
  newAmount: number, 
  note?: string
): Promise<void> {
  const goalRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SAVING_GOALS, goalId);
  const recordRef = doc(collection(goalRef, 'records'), recordId);
  
  const goalDoc = await getDoc(goalRef);
  if (goalDoc.exists()) {
    const data = goalDoc.data() as SavingGoal;
    const batch = writeBatch(db);
    
    // Adjust the goal amount by the difference
    const diff = newAmount - oldAmount;
    batch.set(goalRef, { currentAmount: Math.max(0, data.currentAmount + diff) }, { merge: true });
    
    const recordData: any = { amount: newAmount };
    if (note !== undefined) {
      recordData.note = note;
    }
    
    // Update the record
    batch.set(recordRef, recordData, { merge: true });

    await batch.commit();
  }
}

