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
    ...(targetId !== undefined && { targetId }),
    timestamp: Date.now(),
  } as ActivityFeedItem);
};

// Helper for sending notifications on create, update, delete
const notifyTransactionEvent = async (
  userId: string,
  ledgerId: string,
  txData: Partial<Transaction>,
  eventType: 'created' | 'updated' | 'deleted'
) => {
  try {
    const ledgerDoc = await getDoc(doc(db, 'ledgers', ledgerId));
    if (!ledgerDoc.exists()) return;
    const ledgerData = ledgerDoc.data();
    const mode = ledgerData.mode;
    const timestamp = Date.now();

    const titleMap = {
      created: '新的分帳款項',
      updated: '分帳款項已修改',
      deleted: '分帳款項已刪除'
    };
    const actionText = {
      created: '新增',
      updated: '修改',
      deleted: '刪除'
    }[eventType];

    if (mode === 'split' && txData.splits) {
      for (const split of txData.splits) {
        if (split.userId !== userId) {
          const memberDoc = await getDoc(doc(db, 'ledgers', ledgerId, 'members', split.userId));
          const prefs = memberDoc.exists() ? memberDoc.data().notificationPreferences : null;
          if (prefs?.splitAssigned !== false) {
            let message = '';
            if (eventType === 'created') {
              message = `有人在帳本「${ledgerData.name}」中將您標記為分攤人，金額 $${split.owedAmount}`;
            } else {
              message = `有人${actionText}了帳本「${ledgerData.name}」中您參與的一筆分帳紀錄`;
            }

            await addDoc(collection(db, 'users', split.userId, 'notifications'), {
              userId: split.userId,
              type: 'split_assigned',
              title: titleMap[eventType as keyof typeof titleMap],
              message,
              link: `/ledgers/detail?id=${ledgerId}`,
              isRead: false,
              createdAt: timestamp,
            } as Omit<AppNotification, 'id'>);
          }
        }
      }
    } else if (mode === 'shared_fund' && txData.amount && txData.amount >= 1000) {
      const titleLargeMap = {
        created: '大筆公積金支出',
        updated: '大筆支出已修改',
        deleted: '大筆支出已刪除'
      };
      
      const membersSnap = await getDocs(collection(db, 'ledgers', ledgerId, 'members'));
      for (const memberDoc of membersSnap.docs) {
        const memberId = memberDoc.id;
        const prefs = memberDoc.data().notificationPreferences;
        if (memberId !== userId && prefs?.largeExpense !== false) {
          let message = '';
          if (eventType === 'created') {
            message = `帳本「${ledgerData.name}」新增了一筆 $${txData.amount} 的大額支出`;
          } else {
            message = `帳本「${ledgerData.name}」中的大筆支出紀錄被${actionText}了`;
          }

          await addDoc(collection(db, 'users', memberId, 'notifications'), {
            userId: memberId,
            type: 'large_expense',
            title: titleLargeMap[eventType as keyof typeof titleLargeMap],
            message,
            link: `/ledgers/detail?id=${ledgerId}`,
            isRead: false,
            createdAt: timestamp,
          } as Omit<AppNotification, 'id'>);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to send notifications for ${eventType}`, err);
  }
};


export const createTransaction = async (
  userId: string,
  txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  isSharedLedger: boolean = false
) => {
  const timestamp = Date.now();
  const fullTxData = Object.fromEntries(
    Object.entries({
      ...txData,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).filter(([_, v]) => v !== undefined)
  );

  if (isSharedLedger && txData.ledgerId) {
    const txRef = collection(db, 'ledgers', txData.ledgerId, 'transactions');
    const newTxDoc = await addDoc(txRef, fullTxData);
    
    // 寫入動態時報
    await createActivityFeedItem(
      txData.ledgerId,
      userId,
      'transaction_created',
      `$${txData.amount.toLocaleString()}元`,
      newTxDoc.id
    );

    // Notifications logic
    await notifyTransactionEvent(userId, txData.ledgerId, txData, 'created');
    
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
  
  const cleanTxData = Object.fromEntries(
    Object.entries(txData).filter(([_, v]) => v !== undefined)
  );
  
  if (isSharedLedger && ledgerId) {
    const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
    await updateDoc(docRef, cleanTxData);

    await createActivityFeedItem(
      ledgerId,
      userId,
      'transaction_updated',
      txData.amount ? `$${txData.amount.toLocaleString()}元` : '',
      txId
    );

    await notifyTransactionEvent(userId, ledgerId, txData, 'updated');
  } else {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await updateDoc(docRef, cleanTxData);
  }
};

export const deleteTransaction = async (
  userId: string,
  txId: string,
  isSharedLedger: boolean = false,
  ledgerId?: string,
  deletedTxData?: Partial<Transaction>
) => {
  if (isSharedLedger && ledgerId) {
    const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
    await deleteDoc(docRef);

    await createActivityFeedItem(
      ledgerId,
      userId,
      'transaction_deleted',
      deletedTxData?.amount ? `$${deletedTxData.amount.toLocaleString()}元` : '',
      txId
    );

    if (deletedTxData) {
      await notifyTransactionEvent(userId, ledgerId, deletedTxData, 'deleted');
    }
  } else {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await deleteDoc(docRef);
  }
};
