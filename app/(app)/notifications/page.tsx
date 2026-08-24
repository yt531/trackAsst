'use client';

import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AppNotification } from '@/types';
import { Bell, Check, BellRing, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [selectedRejectedNotif, setSelectedRejectedNotif] = useState<AppNotification | null>(null);
  const [selectedTxStatus, setSelectedTxStatus] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'notifications'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user || marking) return;
    setMarking(true);
    try {
      const batch = writeBatch(db);
      const unreadDocs = notifications.filter(n => !n.isRead);
      unreadDocs.forEach(n => {
        const docRef = doc(db, 'users', user.uid, 'notifications', n.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setMarking(false);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!user) return;
    
    // Mark this single notification as read if it isn't
    if (!notification.isRead) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notification.id), {
          isRead: true
        });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }

    if (notification.type === 'fund_rejected') {
      setSelectedRejectedNotif(notification);
      setSelectedTxStatus(null);
      // Fetch transaction to check if it's already resubmitted
      if (notification.txId && notification.link) {
        const ledgerId = notification.link.split('id=')[1];
        if (ledgerId) {
          import('firebase/firestore').then(({ getDoc, doc }) => {
            getDoc(doc(db, 'ledgers', ledgerId, 'transactions', notification.txId!))
              .then(snap => {
                if (snap.exists()) {
                  setSelectedTxStatus(snap.data().approvalStatus || null);
                }
              });
          });
        }
      }
    } else if (notification.link) {
      router.push(notification.link);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-zinc-500">載入通知中...</div>;
  }

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="relative min-h-screen pb-24">
      <PageHeader title="通知中心" backHref="/" />
      <header className="hidden md:flex mb-6 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
          <p className="text-sm text-zinc-500">所有來自分帳與公積金的活動提醒</p>
        </div>
        {hasUnread && (
          <button 
            onClick={handleMarkAllRead}
            disabled={marking}
            className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Check className="h-4 w-4" />
            全部標示為已讀
          </button>
        )}
      </header>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50 mt-4">
          <div className="mb-3 rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
            <Bell className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-bold">目前沒有通知</h3>
          <p className="max-w-sm text-sm text-zinc-500">
            當有人新增一筆需要您分攤的交易，或是公積金有大額支出時，會顯示在這裡。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {notifications.map(n => (
            <div 
              key={n.id} 
              onClick={() => handleNotificationClick(n)}
              className={`flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                !n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              }`}
            >
              <div className="mt-1 flex shrink-0 items-center justify-center">
                {!n.isRead ? (
                  <div className="relative">
                    <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900"></span>
                  </div>
                ) : (
                  <Bell className="h-5 w-5 text-zinc-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${!n.isRead ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {n.title}
                </h4>
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {n.message}
                </p>
                <div className="mt-2 text-xs font-medium text-zinc-400">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {n.link && (
                <div className="flex shrink-0 items-center self-center text-zinc-400">
                  <ChevronRight className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 退回詳情 Modal */}
      {selectedRejectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-xl font-bold">退回詳情</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-semibold text-zinc-500">退回人：</span>
                <span className="text-zinc-900 dark:text-zinc-100">{selectedRejectedNotif.rejectedByNickname || '管理員'}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-500">退回時間：</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {selectedRejectedNotif.rejectedAt ? new Date(selectedRejectedNotif.rejectedAt).toLocaleString() : '未知時間'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-zinc-500">退回說明：</span>
                <div className="mt-1 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {selectedRejectedNotif.rejectionReason || '無提供說明'}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedRejectedNotif(null)}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 font-semibold transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                關閉
              </button>
              {selectedRejectedNotif.txId && (
                <button
                  disabled={selectedTxStatus === 'pending'}
                  onClick={() => {
                    const ledgerId = selectedRejectedNotif.link?.split('id=')[1];
                    if (ledgerId && selectedRejectedNotif.txId) {
                      router.push(`/ledgers/detail/transactions/edit?id=${ledgerId}&txId=${selectedRejectedNotif.txId}`);
                    }
                  }}
                  className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors ${
                    selectedTxStatus === 'pending' 
                      ? 'bg-zinc-400 cursor-not-allowed dark:bg-zinc-600'
                      : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                  }`}
                >
                  {selectedTxStatus === 'pending' ? '已重新送審 (審核中)' : '重新編輯'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
