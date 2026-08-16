import { db } from './firebase';
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import type { Transaction, ActivityFeedItem, ActivityType, AppNotification } from '../types';

export const createActivityFeedItem = async (
  ledgerId: string,
  actorId: string,
  type: ActivityType,
  details: string,
  targetId?: string
) => {
  const feedRef = collection(db, 'ledgers', ledgerId, 'activityFeed');
  await addDoc(feedRef, {
    ledgerId,
    actorId,
    type,
    details,
    targetId,
    timestamp: Date.now(),
  } as ActivityFeedItem);
};

export const createTransaction = async (
  userId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  isSharedLedger: boolean = false
) => {
  const timestamp = Date.now();
  const fullTxData = {
    ...txData,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (isSharedLedger && txData.ledgerId) {
    const txRef = collection(db, 'ledgers', txData.ledgerId, 'transactions');
    const newTxDoc = await addDoc(txRef, fullTxData);
    
    // 寫入動態時報
    await createActivityFeedItem(
      txData.ledgerId,
      userId,
      'transaction_created',
      `新增了一筆交易: ${txData.amount}`,
      newTxDoc.id
    );

    // Notifications logic
    try {
      const ledgerDoc = await getDoc(doc(db, 'ledgers', txData.ledgerId));
      if (ledgerDoc.exists()) {
        const ledgerData = ledgerDoc.data();
        const mode = ledgerData.mode;

        if (mode === 'split' && txData.splits) {
          // Notify everyone in splits except the actor
          for (const split of txData.splits) {
            if (split.userId !== userId) {
              await addDoc(collection(db, 'users', split.userId, 'notifications'), {
                userId: split.userId,
                type: 'split_assigned',
                title: '新的分帳款項',
                message: `有人在帳本「${ledgerData.name}」中將您標記為分攤人，金額 $${split.owedAmount}`,
                link: `/ledgers/detail?id=${txData.ledgerId}`,
                isRead: false,
                createdAt: timestamp,
              } as Omit<AppNotification, 'id'>);
            }
          }
        } else if (mode === 'shared_fund' && txData.amount >= 1000) {
          // Large expense in shared fund -> notify all other members
          const membersSnap = await getDocs(collection(db, 'ledgers', txData.ledgerId, 'members'));
          for (const memberDoc of membersSnap.docs) {
            const memberId = memberDoc.id;
            if (memberId !== userId) {
              await addDoc(collection(db, 'users', memberId, 'notifications'), {
                userId: memberId,
                type: 'large_expense',
                title: '大筆公積金支出',
                message: `帳本「${ledgerData.name}」新增了一筆 $${txData.amount} 的大額支出`,
                link: `/ledgers/detail?id=${txData.ledgerId}`,
                isRead: false,
                createdAt: timestamp,
              } as Omit<AppNotification, 'id'>);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send notifications', err);
    }
    
    return newTxDoc.id;
  } else {
    // 個人帳本
    const txRef = collection(db, 'users', userId, 'transactions');
    const newTxDoc = await addDoc(txRef, fullTxData);
    return newTxDoc.id;
  }
};

export const updateTransaction = async (
  userId: string,
  txId: string,
  txData: Partial<Transaction>,
  isSharedLedger: boolean = false,
  ledgerId?: string
) => {
  txData.updatedAt = Date.now();
  
  if (isSharedLedger && ledgerId) {
    const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
    await updateDoc(docRef, txData);

    await createActivityFeedItem(
      ledgerId,
      userId,
      'transaction_updated',
      `更新了一筆交易`,
      txId
    );
  } else {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await updateDoc(docRef, txData);
  }
};

export const deleteTransaction = async (
  userId: string,
  txId: string,
  isSharedLedger: boolean = false,
  ledgerId?: string
) => {
  if (isSharedLedger && ledgerId) {
    const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
    await deleteDoc(docRef);
  } else {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await deleteDoc(docRef);
  }
};
