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

// Check if a nickname already exists in a ledger
export const checkNicknameExists = async (ledgerId: string, nickname: string, excludeUserId?: string): Promise<boolean> => {
  try {
    const membersRef = collection(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS);
    const q = query(membersRef, where('nickname', '==', nickname));
    const snap = await getDocs(q);
    
    if (snap.empty) return false;
    
    if (excludeUserId) {
      return snap.docs.some(doc => doc.id !== excludeUserId);
    }
    
    return true;
  } catch (error: any) {
    // If the user hasn't joined yet, Firestore rules will throw permission-denied
    if (error.code === 'permission-denied') {
      console.warn('Permission denied checking nickname, assuming it is available.');
      return false; // Bypass the check and let the write attempt proceed
    }
    throw error;
  }
};

// Update member role or settings
export const updateLedgerMember = async (ledgerId: string, userId: string, data: Partial<LedgerMember>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS, userId);
  await updateDoc(docRef, data);
};

// Leave ledger
export const leaveLedger = async (ledgerId: string, userId: string, transferAdminToId?: string) => {
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);

  if (transferAdminToId) {
    const adminDocRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS, transferAdminToId);
    batch.update(adminDocRef, { role: 'admin' });
  }

  const userDocRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, LEDGER_COLLECTIONS.MEMBERS, userId);
  batch.update(userDocRef, { status: 'left' });

  const userMembershipRef = doc(db, 'users', userId, 'ledgerMemberships', ledgerId);
  batch.delete(userMembershipRef);

  await batch.commit();
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

// ==========================================
// Fund Collections
// ==========================================

import type { FundCollection, AppNotification, Transaction, MemberBalanceLog } from '../types';

export const getFundCollections = async (ledgerId: string): Promise<FundCollection[]> => {
  const collectionsRef = collection(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'collections');
  const snap = await getDocs(collectionsRef);
  return snap.docs.map(doc => doc.data() as FundCollection).sort((a, b) => b.createdAt - a.createdAt);
};

export const createFundCollection = async (ledgerId: string, data: FundCollection) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'collections', data.id);
  await setDoc(docRef, data);

  // Send collection_notice to all members
  const ledger = await getLedger(ledgerId);
  
  if (ledger) {
    for (const memberId of data.memberIds || []) {
      if (memberId !== data.createdBy) {
        await setDoc(doc(collection(db, 'users', memberId, 'notifications')), {
          userId: memberId,
          type: 'collection_notice',
          title: '發起新收款',
          message: `在「${ledger.name}」發起了新收款「${data.title}」，請繳交 ${data.targetAmount} 元。`,
          link: `/ledgers/detail?id=${ledgerId}`,
          isRead: false,
          createdAt: Date.now(),
        } as Omit<AppNotification, 'id'>);
      }
    }
  }
};

export const updateFundCollection = async (ledgerId: string, collectionId: string, data: Partial<FundCollection>) => {
  const docRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'collections', collectionId);
  await updateDoc(docRef, data);
};

export const recalculateCollection = async (
  ledgerId: string, 
  collectionId: string, 
  newTargetAmount: number, 
  newMemberIds: string[], 
  newTotalAmount: number | undefined,
  adminUserId: string,
  note: string
) => {
  const { writeBatch } = await import('firebase/firestore');
  
  // 1. Update collection
  const collRef = doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId, 'collections', collectionId);
  await updateDoc(collRef, {
    targetAmount: newTargetAmount,
    memberIds: newMemberIds,
    totalAmount: newTotalAmount
  });

  // 2. Fetch all income transactions for this collection
  const txQuery = query(collection(db, 'ledgers', ledgerId, 'transactions'), where('collectionId', '==', collectionId), where('type', '==', 'income'));
  const txSnap = await getDocs(txQuery);
  const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  
  // 3. Group by user
  const userPaidAmount: Record<string, number> = {};
  const userTxs: Record<string, Transaction[]> = {};
  txs.forEach(tx => {
    if (tx.approvalStatus === 'approved' || !tx.approvalStatus) { // only count approved/valid ones
      userPaidAmount[tx.userId] = (userPaidAmount[tx.userId] || 0) + tx.amount;
      if (!userTxs[tx.userId]) userTxs[tx.userId] = [];
      userTxs[tx.userId].push(tx);
    }
  });

  const overflowResults: { userId: string; overflow: number }[] = [];
  const batch = writeBatch(db);

  // 4. Process overflow
  for (const userId of Object.keys(userPaidAmount)) {
    const paid = userPaidAmount[userId];
    if (paid > newTargetAmount) {
      const overflow = paid - newTargetAmount;
      overflowResults.push({ userId, overflow });
      
      // Reduce transaction amount (take the most recent one for simplicity)
      const userTxList = userTxs[userId].sort((a, b) => b.date - a.date);
      let remainingOverflow = overflow;
      for (const tx of userTxList) {
        if (remainingOverflow <= 0) break;
        const deduct = Math.min(tx.amount, remainingOverflow);
        const txRef = doc(db, 'ledgers', ledgerId, 'transactions', tx.id);
        batch.update(txRef, { amount: tx.amount - deduct });
        remainingOverflow -= deduct;
      }

      // Add to member balance
      const memberRef = doc(db, 'ledgers', ledgerId, 'members', userId);
      const memberDoc = await getDoc(memberRef);
      if (memberDoc.exists()) {
        const memberData = memberDoc.data() as LedgerMember;
        batch.update(memberRef, { balance: (memberData.balance || 0) + overflow });
      }

      // Create Balance Log
      const logRef = doc(collection(db, 'ledgers', ledgerId, 'balanceLogs'));
      batch.set(logRef, {
        id: logRef.id,
        ledgerId,
        userId,
        amount: overflow,
        type: 'overpayment_add',
        note,
        createdAt: Date.now(),
        createdBy: adminUserId
      } as MemberBalanceLog);
    }
  }

  await batch.commit();
  return overflowResults;
};
