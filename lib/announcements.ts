import { db } from './firebase';
import { addDoc, collection, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { Announcement, LedgerMember } from '../types';

const colRef = (ledgerId: string) => collection(db, 'ledgers', ledgerId, 'announcements');

// 顯示中：未取消且未過期
export const isAnnouncementActive = (a: Announcement, now: number) =>
  a.status === 'active' && (!a.expiresAt || a.expiresAt > now);

// 下架時間：已取消取取消時間，否則為到期時間
export const getTakedownAt = (a: Announcement) =>
  a.status === 'cancelled' ? a.cancelledAt : a.expiresAt;

export const getMemberName = (members: LedgerMember[], uid: string, selfId: string) => {
  if (uid === selfId) return '您';
  return members.find(m => m.userId === uid)?.nickname || `使用者 ${uid.slice(0, 4)}`;
};

export const fetchAnnouncements = async (ledgerId: string): Promise<Announcement[]> => {
  const snap = await getDocs(colRef(ledgerId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
};

export const createAnnouncement = async (
  ledgerId: string,
  authorId: string,
  content: string,
  expiresAt?: number,
) => {
  const now = Date.now();
  const data: Omit<Announcement, 'id'> = {
    ledgerId,
    authorId,
    content,
    createdAt: now,
    order: -now, // 預設最新在前
    status: 'active',
    ...(expiresAt !== undefined && { expiresAt }),
  };
  await addDoc(colRef(ledgerId), data);
};

// expiresAt 傳 null 代表清除到期時間
export const editAnnouncement = async (
  announcement: Announcement,
  content: string,
  expiresAt: number | null,
) => {
  const update: Record<string, unknown> = { content, updatedAt: Date.now() };
  update.expiresAt = expiresAt === null ? null : expiresAt;
  await updateDoc(doc(db, 'ledgers', announcement.ledgerId, 'announcements', announcement.id), update);
};

// 取消公告：保留紀錄，僅從公告區移除並進入歷史公告
export const cancelAnnouncement = async (announcement: Announcement, cancelledBy: string) => {
  await updateDoc(doc(db, 'ledgers', announcement.ledgerId, 'announcements', announcement.id), {
    status: 'cancelled',
    cancelledAt: Date.now(),
    cancelledBy,
  });
};

// 依傳入順序重新編號 order（0、1、2…）
export const reorderAnnouncements = async (ledgerId: string, orderedIds: string[]) => {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'ledgers', ledgerId, 'announcements', id), { order: index });
  });
  await batch.commit();
};
