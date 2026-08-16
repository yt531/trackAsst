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
