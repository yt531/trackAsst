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
  SETTINGS: 'settings',
};

// Generic Helper to get a Subcollection Reference (users/{userId}/{collectionName})
export const getUserCollection = (userId: string, collectionName: string) => {
  return collection(db, COLLECTIONS.USERS, userId, collectionName);
};

export const getUserDoc = (userId: string, collectionName: string, docId: string) => {
  return doc(db, COLLECTIONS.USERS, userId, collectionName, docId);
};

// ... More specific CRUD operations can be added here as needed later
