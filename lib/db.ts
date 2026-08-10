import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  Transaction,
  Invoice,
  PaymentMethod,
  Category,
  UserSettings,
  Budget,
} from '../types';

// Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  INVOICES: 'invoices',
  PAYMENT_METHODS: 'paymentMethods',
  CATEGORIES: 'categories',
  BUDGETS: 'budgets',
  SAVING_GOALS: 'savingGoals',
  SETTINGS: 'settings',
  TAGS: 'tags',
};

// Generic Helper to get a Subcollection Reference (users/{userId}/{collectionName})
export const getUserCollection = (userId: string, collectionName: string) => {
  return collection(db, COLLECTIONS.USERS, userId, collectionName);
};

export const getUserDoc = (userId: string, collectionName: string, docId: string) => {
  return doc(db, COLLECTIONS.USERS, userId, collectionName, docId);
};

// Security Settings Helpers
export const getSecuritySettings = async (userId: string) => {
  const docRef = getUserDoc(userId, COLLECTIONS.SETTINGS, 'security');
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
};

export const setSecuritySettings = async (userId: string, data: any) => {
  const docRef = getUserDoc(userId, COLLECTIONS.SETTINGS, 'security');
  await setDoc(docRef, data, { merge: true });
};

// General User Settings (Preferences) Helpers
export const getUserSettings = async (userId: string): Promise<Partial<UserSettings> | null> => {
  const docRef = getUserDoc(userId, COLLECTIONS.SETTINGS, 'preferences');
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Partial<UserSettings>) : null;
};

export const setUserSettings = async (userId: string, data: Partial<UserSettings>) => {
  const docRef = getUserDoc(userId, COLLECTIONS.SETTINGS, 'preferences');
  await setDoc(docRef, data, { merge: true });
};
