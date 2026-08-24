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

// Helper for calculating who can approve
const getApproverIds = (submitterId: string, membersSnap: any, lastModifiedBy?: string) => {
  const members = membersSnap.docs.map((d: any) => d.data());
  const actualInitiator = lastModifiedBy || submitterId;
  const initiatorRole = members.find((m: any) => m.userId === actualInitiator)?.role || 'viewer';
  
  const hasViceAdmin = members.some((m: any) => m.role === 'vice_admin');

  return members.filter((m: any) => {
    // 1. 自己不能審核自己
    if (m.userId === actualInitiator) return false;

    const role = m.role;

    // 3. 特例: 只有 2 人且沒有副管理員，允許另一位成員審核
    if (members.length === 2 && !hasViceAdmin) {
      return true; // since we already filtered out actualInitiator
    }

    // 2. 正常情況下: 由 Admin 或 Vice Admin 審核
    if (initiatorRole === 'admin') {
      return role === 'vice_admin' || role === 'admin';
    } else {
      return role === 'admin' || role === 'vice_admin';
    }
  }).map((m: any) => m.userId);
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
    } else if (mode === 'shared_fund') {
      const membersSnap = await getDocs(collection(db, 'ledgers', ledgerId, 'members'));
      
      // 1. Pending Approval Notifications
      const isPendingSubmit = (eventType === 'created' || eventType === 'updated') && txData.approvalStatus === 'pending';
      const isPendingDelete = eventType === 'updated' && txData.approvalStatus === 'pending_delete';
      
      if ((isPendingSubmit || isPendingDelete) && txData.userId) {
        const approverIds = getApproverIds(txData.userId, membersSnap, txData.lastModifiedBy);
        
        const initiatorId = txData.lastModifiedBy || txData.userId;
        const submitter = membersSnap.docs.find(d => d.data().userId === initiatorId)?.data();
        const payer = txData.payerId ? membersSnap.docs.find(d => d.data().userId === txData.payerId)?.data() : submitter;
        
        const submitterName = submitter?.nickname || submitter?.userId.slice(0, 4);
        const payerName = payer?.nickname || payer?.userId.slice(0, 4);

        let msg = '';
        let title = '';
        let notifType: NotificationType = 'fund_pending_approval';

        if (isPendingDelete) {
          title = '待審核刪除';
          msg = `${submitterName} 申請刪除了一筆 $${txData.amount} 的繳款，等待您的審核。`;
          notifType = 'transaction_delete_pending';
        } else {
          title = eventType === 'updated' ? '待審核繳款(已修改)' : '待審核繳款';
          notifType = eventType === 'updated' ? 'transaction_update_pending' : 'fund_pending_approval';
          msg = txData.payerId && txData.payerId !== initiatorId
            ? `${submitterName} 代 ${payerName} 送出了一筆 $${txData.amount} 的繳款，等待您的審核。`
            : `${submitterName} 送出了一筆 $${txData.amount} 的繳款，等待您的審核。`;
        }

        for (const aId of approverIds) {
          if (aId === initiatorId) continue;
          await addDoc(collection(db, 'users', aId, 'notifications'), {
            userId: aId,
            type: notifType,
            title,
            message: msg,
            link: `/ledgers/detail?id=${ledgerId}`,
            isRead: false,
            createdAt: timestamp,
            submitterNickname: submitterName,
            payerNickname: payerName
          } as Omit<AppNotification, 'id'>);
        }
      }
      // 2. Large Expense Notifications
      if (txData.amount && txData.amount >= 1000) {
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

      // Check balance for fund_empty warning
      const txSnap = await getDocs(collection(db, 'ledgers', ledgerId, 'transactions'));
      let currentBalance = 0;
      txSnap.docs.forEach(d => {
        const tx = d.data() as Transaction;
        let isIncluded = true;
        if (tx.type === 'expense' && tx.isAdvancePayment && tx.advancePaymentStatus === 'unsettled') {
          isIncluded = false;
        }
        if (isIncluded) {
          const isApproved = !tx.approvalStatus || tx.approvalStatus === 'approved';
          if (isApproved) {
            if (tx.type === 'income') currentBalance += tx.amount;
            else if (tx.type === 'expense' || tx.type === 'settlement') currentBalance -= tx.amount;
          }
        }
      });

      // Rough estimation of previous balance (assumes creation or non-amount updates for simplicity)
      let prevBalance = currentBalance;
      if (eventType === 'created' && txData.amount) {
        let eff = 0;
        const isApproved = !txData.approvalStatus || txData.approvalStatus === 'approved';
        if (isApproved) {
          if (txData.type === 'income') eff = txData.amount;
          else if (txData.type === 'expense' || txData.type === 'settlement') {
            let isAdv = txData.isAdvancePayment && txData.advancePaymentStatus === 'unsettled';
            if (!isAdv) eff = -txData.amount;
          }
        }
        prevBalance = currentBalance - eff;
      }

      // Only notify if it went from > 0 to <= 0, or if it's creation of an expense and already <= 0 (avoiding spam on every update)
      const justDropped = prevBalance > 0 && currentBalance <= 0;
      if (justDropped) {
        for (const memberDoc of membersSnap.docs) {
          const mData = memberDoc.data();
          if (['admin', 'vice_admin', 'editor'].includes(mData.role)) {
             await addDoc(collection(db, 'users', mData.userId, 'notifications'), {
               userId: mData.userId,
               type: 'fund_empty',
               title: '⚠️ 公積金餘額見底',
               message: `帳本「${ledgerData.name}」的公積金餘額已不足，請盡快存入款項！`,
               link: `/ledgers/detail?id=${ledgerId}`,
               isRead: false,
               createdAt: timestamp,
             } as Omit<AppNotification, 'id'>);
          }
        }
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
    
    // Fetch original to check status
    const origSnap = await getDoc(docRef);
    if (origSnap.exists()) {
      const orig = origSnap.data() as Transaction;
      if (orig.approvalStatus === 'approved' || orig.approvalStatus === 'rejected') {
         cleanTxData.approvalStatus = 'pending';
         cleanTxData.lastModifiedBy = userId;
         
         const newLog = {
           type: 'resubmitted' as const,
           by: userId,
           at: Date.now()
         };
         cleanTxData.auditLogs = [...(orig.auditLogs || []), newLog];
      }
    }

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
    
    if (deletedTxData?.approvalStatus === 'approved') {
      // 審核通過的交易不直接刪除，轉為 pending_delete
      await updateDoc(docRef, {
        approvalStatus: 'pending_delete',
        lastModifiedBy: userId,
        updatedAt: Date.now()
      });
      await notifyTransactionEvent(userId, ledgerId, { ...deletedTxData, approvalStatus: 'pending_delete', lastModifiedBy: userId }, 'updated');
    } else {
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
    }
  } else {
    const docRef = doc(db, 'users', userId, 'transactions', txId);
    await deleteDoc(docRef);
  }
};

export const approveTransaction = async (
  ledgerId: string,
  txId: string,
  userId: string,
  approvedByUserId: string
) => {
  const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
  const txSnap = await getDoc(docRef);
  
  if (txSnap.exists()) {
    const txData = txSnap.data() as Transaction;
    
    if (txData.approvalStatus === 'pending_delete') {
      // 審核同意刪除 -> 正式刪除
      await deleteDoc(docRef);
      await createActivityFeedItem(ledgerId, userId, 'transaction_deleted', txData.amount ? `$${txData.amount.toLocaleString()}元` : '', txId);
      await notifyTransactionEvent(userId, ledgerId, txData, 'deleted');
      return;
    }

    // 審核同意新增/修改 -> 狀態變為 approved
    const newLog = { type: 'approved' as const, by: approvedByUserId, at: Date.now() };
    await updateDoc(docRef, {
      approvalStatus: 'approved',
      approvedBy: approvedByUserId,
      updatedAt: Date.now(),
      auditLogs: [...(txData.auditLogs || []), newLog]
    });

    const membersSnap = await getDocs(collection(db, 'ledgers', ledgerId, 'members'));
    const submitter = membersSnap.docs.find(d => d.data().userId === txData.userId)?.data();
    const payer = txData.payerId ? membersSnap.docs.find(d => d.data().userId === txData.payerId)?.data() : submitter;
    const approver = membersSnap.docs.find(d => d.data().userId === approvedByUserId)?.data();
    
    const approverName = approver?.nickname || approver?.userId.slice(0, 4);
    const msg = txData.payerId && txData.payerId !== txData.userId
      ? `您代 ${payer?.nickname || payer?.userId.slice(0,4)} 送出的繳款已由 ${approverName} 核准。`
      : `您的繳款已由 ${approverName} 核准。`;
      
    await addDoc(collection(db, 'users', txData.userId, 'notifications'), {
      userId: txData.userId,
      type: 'fund_approved',
      title: '繳款已核准',
      message: msg,
      link: `/ledgers/detail?id=${ledgerId}`,
      isRead: false,
      createdAt: Date.now()
    } as Omit<AppNotification, 'id'>);

    // We can also trigger notifyTransactionEvent here as an 'updated' event
    // so it recalculates balance and potentially triggers fund_empty if somehow relevant
    await notifyTransactionEvent(userId, ledgerId, { ...txData, approvalStatus: 'approved' }, 'updated');
  }
};

export const rejectTransaction = async (
  ledgerId: string,
  txId: string,
  userId: string,
  rejectedByUserId: string,
  reason: string
) => {
  const docRef = doc(db, 'ledgers', ledgerId, 'transactions', txId);
  const txSnap = await getDoc(docRef);
  
  if (txSnap.exists()) {
    const txData = txSnap.data() as Transaction;
    const rejectedAt = Date.now();
    
    const newLog = { type: 'rejected' as const, by: rejectedByUserId, at: rejectedAt, reason };
    
    if (txData.approvalStatus === 'pending_delete') {
      // 駁回刪除請求 -> 恢復為 approved
      await updateDoc(docRef, {
        approvalStatus: 'approved',
        updatedAt: rejectedAt,
        auditLogs: [...(txData.auditLogs || []), newLog]
      });
      // 這裡可以考慮發送「駁回刪除」的通知，為了簡單，我們繼續用 fund_rejected 通知，或者改一下 message
    } else {
      // 駁回新增/修改請求 -> 狀態變為 rejected
      await updateDoc(docRef, {
        approvalStatus: 'rejected',
        rejectedBy: rejectedByUserId,
        rejectionReason: reason,
        rejectedAt,
        updatedAt: rejectedAt,
        auditLogs: [...(txData.auditLogs || []), newLog]
      });
    }

    const membersSnap = await getDocs(collection(db, 'ledgers', ledgerId, 'members'));
    const submitter = membersSnap.docs.find(d => d.data().userId === txData.userId)?.data();
    const payer = txData.payerId ? membersSnap.docs.find(d => d.data().userId === txData.payerId)?.data() : submitter;
    const rejecter = membersSnap.docs.find(d => d.data().userId === rejectedByUserId)?.data();
    
    const rejecterName = rejecter?.nickname || rejecter?.userId.slice(0, 4);
    const submitterName = submitter?.nickname || submitter?.userId.slice(0, 4);
    const payerName = payer?.nickname || payer?.userId.slice(0, 4);
    
    let msg = '';
    let notifTitle = '繳款被退回';
    if (txData.approvalStatus === 'pending_delete') {
      notifTitle = '刪除請求被退回';
      msg = `您申請刪除的繳款被 ${rejecterName} 退回了。退回原因：${reason}`;
    } else {
      msg = txData.payerId && txData.payerId !== txData.userId
        ? `您代 ${payerName} 送出的繳款被 ${rejecterName} 退回了。退回原因：${reason}`
        : `您的繳款被 ${rejecterName} 退回了。退回原因：${reason}`;
    }

    await addDoc(collection(db, 'users', txData.userId, 'notifications'), {
      userId: txData.userId,
      type: 'fund_rejected',
      title: notifTitle,
      message: msg,
      link: `/ledgers/detail?id=${ledgerId}`,
      isRead: false,
      createdAt: rejectedAt,
      rejectionReason: reason,
      rejectedAt,
      rejectedByNickname: rejecterName,
      submitterNickname: submitterName,
      payerNickname: payerName,
      txId
    } as Omit<AppNotification, 'id'>);
  }
};
