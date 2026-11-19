import { db } from './firebase';
import { collection, doc, getDocs, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { LedgerMember, LedgerNotice, AppNotification } from '../types';

export const isLedgerManagerRole = (role?: string) => role === 'admin' || role === 'vice_admin';

// 每位收件人的通知副本使用固定 ID，修改／刪除時不必另外查詢
const notificationCopyId = (noticeId: string) => `notice_${noticeId}`;

interface SendNoticeInput {
  ledgerId: string;
  ledgerName: string;
  authorId: string;
  content: string;
  mentionAll: boolean;
  mentionedIds: string[]; // mentionAll 為 true 時忽略
  members: LedgerMember[];
}

export const sendNotice = async ({
  ledgerId, ledgerName, authorId, content, mentionAll, mentionedIds, members,
}: SendNoticeInput) => {
  const activeMembers = members.filter(m => m.status === 'active' || !m.status);
  const recipientIds = mentionAll
    ? activeMembers.map(m => m.userId)
    : Array.from(new Set(mentionedIds));
  const managerIds = activeMembers.filter(m => isLedgerManagerRole(m.role)).map(m => m.userId);
  const viewerIds = Array.from(new Set([...recipientIds, ...managerIds, authorId]));

  const noticeRef = doc(collection(db, 'ledgers', ledgerId, 'notices'));
  const now = Date.now();
  const notice: Omit<LedgerNotice, 'id'> = {
    ledgerId,
    authorId,
    content,
    mentionAll,
    mentionedIds: recipientIds,
    viewerIds,
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(noticeRef, notice);
  for (const uid of recipientIds) {
    if (uid === authorId) continue; // 不通知自己
    const copy: Omit<AppNotification, 'id'> = {
      userId: uid,
      senderId: authorId,
      type: 'admin_notice',
      ledgerId,
      noticeId: noticeRef.id,
      title: `${ledgerName}：管理員通知`,
      message: content,
      link: `/ledgers/detail/timeline?id=${ledgerId}`,
      isRead: false,
      createdAt: now,
    };
    batch.set(doc(db, 'users', uid, 'notifications', notificationCopyId(noticeRef.id)), copy);
  }
  await batch.commit();
  return noticeRef.id;
};

// 副本可能已被收件人自行刪除，逐筆更新並忽略不存在的文件
const updateCopies = async (notice: LedgerNotice, data: Partial<AppNotification>) => {
  await Promise.allSettled(
    notice.mentionedIds.map(uid =>
      updateDoc(doc(db, 'users', uid, 'notifications', notificationCopyId(notice.id)), data)
    )
  );
};

export const editNotice = async (notice: LedgerNotice, content: string) => {
  await updateDoc(doc(db, 'ledgers', notice.ledgerId, 'notices', notice.id), {
    content,
    updatedAt: Date.now(),
  });
  // 重設為未讀以通知對方，並標示已編輯
  await updateCopies(notice, { message: content, edited: true, isRead: false });
};

// 軟刪除：保留紀錄，收件人的通知副本標記為已刪除（通知頁不再顯示）
export const deleteNotice = async (notice: LedgerNotice, deletedBy: string) => {
  await updateDoc(doc(db, 'ledgers', notice.ledgerId, 'notices', notice.id), {
    deleted: true,
    deletedAt: Date.now(),
    deletedBy,
  });
  await updateCopies(notice, { deleted: true, isRead: true });
};

// 管理員可讀全部；一般成員只能查到自己在 viewerIds 內的通知（需與規則一致）
export const fetchNotices = async (ledgerId: string, uid: string, isManager: boolean): Promise<LedgerNotice[]> => {
  const col = collection(db, 'ledgers', ledgerId, 'notices');
  const q = isManager ? query(col) : query(col, where('viewerIds', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LedgerNotice))
    .filter(n => isManager || !n.deleted) // 已刪除的通知只有管理員看得到紀錄
    .sort((a, b) => b.createdAt - a.createdAt);
};
