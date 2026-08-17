import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  Ledger,
  LedgerMember,
  LedgerInvitation,
  Category,
  Tag,
} from '../types';

export const LEDGER_COLLECTIONS = {
  LEDGERS: 'ledgers',
  MEMBERS: 'members',
  INVITATIONS: 'ledgerInvitations',
};

// Create a new ledger (personal or shared)
export const createLedger = async (ledger: Ledger) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledger.id);
  await setDoc(docRef, ledger);
};

// Get a ledger by ID
export const getLedger = async (ledgerId: string): Promise<Ledger | null> => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as Ledger) : null;
};

// Update a ledger
export const updateLedger = async (ledgerId: string, data: Partial<Ledger>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId);
  await updateDoc(docRef, data);
};

// Add a member to a ledger
export const addLedgerMember = async (member: LedgerMember) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, member.ledgerId, LEDGER_COLLECTIONS.MEMBERS, member.userId);
  await setDoc(docRef, member);
  
  // Save a reference in the user's document for easy querying without collectionGroup
  const userMembershipRef = doc(db, 'users', member.userId, 'ledgerMemberships', member.ledgerId);
  await setDoc(userMembershipRef, {
    ledgerId: member.ledgerId,
    role: member.role,
    joinedAt: member.joinedAt
  });
};

// Get all members of a ledger
export const getLedgerMembers = async (ledgerId: string): Promise<LedgerMember[]> => {
  const membersRef = collection(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS);
  const snap = await getDocs(membersRef);
  return snap.docs.map(doc => doc.data() as LedgerMember);
};

// Update member role or settings
export const updateLedgerMember = async (ledgerId: string, userId: string, data: Partial<LedgerMember>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS, userId);
  await updateDoc(docRef, data);
};

// Remove a member
export const removeLedgerMember = async (ledgerId: string, userId: string) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS, userId);
  await deleteDoc(docRef);
  
  const userMembershipRef = doc(db, 'users', userId, 'ledgerMemberships', ledgerId);
  await deleteDoc(userMembershipRef);
};

// Create an invitation
export const createLedgerInvitation = async (invitation: LedgerInvitation) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.INVITATIONS, invitation.id);
  await setDoc(docRef, invitation);
};

// Get an invitation by ID
export const getLedgerInvitation = async (invitationId: string): Promise<LedgerInvitation | null> => {
  const docRef = doc(db, LEDGER_COLLECTIONS.INVITATIONS, invitationId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as LedgerInvitation) : null;
};

// ==========================================
// Shared Categories
// ==========================================

export const getLedgerCategories = async (ledgerId: string): Promise<Category[]> => {
  const categoriesRef = collection(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'categories');
  const snap = await getDocs(categoriesRef);
  return snap.docs.map(doc => doc.data() as Category).sort((a, b) => a.order - b.order);
};

export const createLedgerCategory = async (ledgerId: string, category: Category) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'categories', category.id);
  await setDoc(docRef, category);
};

export const updateLedgerCategory = async (ledgerId: string, categoryId: string, data: Partial<Category>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'categories', categoryId);
  await updateDoc(docRef, data);
};

export const deleteLedgerCategory = async (ledgerId: string, categoryId: string) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'categories', categoryId);
  // Optional: check if category is used before deleting or handle safely
  await deleteDoc(docRef);
};

// ==========================================
// Shared Tags
// ==========================================

export const getLedgerTags = async (ledgerId: string): Promise<Tag[]> => {
  const tagsRef = collection(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'tags');
  const snap = await getDocs(tagsRef);
  return snap.docs.map(doc => doc.data() as Tag).sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const createLedgerTag = async (ledgerId: string, tag: Tag) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'tags', tag.id);
  await setDoc(docRef, tag);
};

export const updateLedgerTag = async (ledgerId: string, tagId: string, data: Partial<Tag>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'tags', tagId);
  await updateDoc(docRef, data);
};

export const deleteLedgerTag = async (ledgerId: string, tagId: string) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'tags', tagId);
  await deleteDoc(docRef);
};

