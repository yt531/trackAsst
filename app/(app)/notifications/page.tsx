'use client';

import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, limit, startAfter, where, getDocs, doc, writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AppNotification } from '@/types';
import { Bell, Check, CheckCheck, BellRing, ChevronRight, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { confirmAsync } from '@/lib/confirm';

const PAGE_SIZE = 50; // 「全部」分頁每次載入的數量
const BATCH_SIZE = 400; // Firestore 單一批次上限 500 筆，保留餘裕

type Tab = 'all' | 'unread';

const toNotification = (d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as AppNotification);

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<AppNotification[]>([]); // 「全部」分頁（分頁載入）
  const [unreadItems, setUnreadItems] = useState<AppNotification[]>([]); // 「未讀」分頁（全部未讀）
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRejectedNotif, setSelectedRejectedNotif] = useState<AppNotification | null>(null);
  const [selectedTxStatus, setSelectedTxStatus] = useState<string | null>(null);

  const notificationsRef = () => collection(db, 'users', user!.uid, 'notifications');

  const loadFirstPage = async () => {
    const snap = await getDocs(query(notificationsRef(), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)));
    setItems(snap.docs.map(toNotification).filter(n => !n.deleted));
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
    setHasMore(snap.docs.length === PAGE_SIZE);
  };

  // 只用單一欄位的相等條件，不需要額外索引；未讀通常不多，一次全部讀入
  const loadUnread = async () => {
    const snap = await getDocs(query(notificationsRef(), where('isRead', '==', false)));
    setUnreadItems(snap.docs.map(toNotification).filter(n => !n.deleted).sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadFirstPage(), loadUnread()]);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLoadMore = async () => {
    if (!user || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(notificationsRef(), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
      );
      setItems(prev => [...prev, ...snap.docs.map(toNotification).filter(n => !n.deleted)]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? lastDoc);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // 標示已讀／未讀；數量多時自動分批寫入
  const setReadState = async (ids: string[], isRead: boolean) => {
    if (!user || ids.length === 0) return;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH_SIZE).forEach(id => {
        batch.update(doc(db, 'users', user.uid, 'notifications', id), { isRead });
      });
      await batch.commit();
    }
    const idSet = new Set(ids);
    setItems(prev => prev.map(n => (idSet.has(n.id) ? { ...n, isRead } : n)));
    setUnreadItems(prev => {
      if (isRead) return prev.filter(n => !idSet.has(n.id));
      // 標示為未讀的通知一定來自「全部」分頁（已載入），直接補進未讀清單
      const existing = new Set(prev.map(n => n.id));
      const added = items.filter(n => idSet.has(n.id) && !existing.has(n.id)).map(n => ({ ...n, isRead: false }));
      return [...prev, ...added].sort((a, b) => b.createdAt - a.createdAt);
    });
  };

  const runAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error('Notification action failed', err);
      alert('操作失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadItems.length === 0) return;
    if (!(await confirmAsync(`確定要將 ${unreadItems.length} 則未讀通知全部標示為已讀嗎？`))) return;
    await runAction(async () => {
      // 重新查詢一次，確保包含載入頁面之後才收到的未讀
      const snap = await getDocs(query(notificationsRef(), where('isRead', '==', false)));
      await setReadState(snap.docs.map(d => d.id), true);
    });
  };

  const visibleItems = tab === 'all' ? items : unreadItems;

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelected = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = visibleItems.length > 0 && visibleItems.every(n => selected.has(n.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleItems.map(n => n.id)));

  const applySelection = (isRead: boolean) => {
    const ids = Array.from(selected);
    runAction(async () => {
      await setReadState(ids, isRead);
      exitSelectMode();
    });
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!user) return;

    // 點進通知時，若尚未讀就順便標示為已讀
    if (!notification.isRead) {
      try {
        await setReadState([notification.id], true);
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

  const tabClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
    }`;

  return (
    <div className="relative min-h-screen pb-24">
      <PageHeader title="通知中心" backHref="/" />
      <header className="hidden md:block mb-6">
        <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
        <p className="text-sm text-zinc-500">所有來自分帳與公積金的活動提醒</p>
      </header>

      {/* 篩選分頁與批次操作（手機與桌面都看得到） */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <button onClick={() => setTab('all')} className={tabClass(tab === 'all')}>全部</button>
          <button onClick={() => setTab('unread')} className={tabClass(tab === 'unread')}>
            未讀{unreadItems.length > 0 ? ` ${unreadItems.length}` : ''}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            disabled={visibleItems.length === 0 && !selectMode}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {selectMode ? '取消選取' : '選取'}
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={busy || unreadItems.length === 0}
            className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-40 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <CheckCheck className="h-4 w-4" />
            {busy ? '處理中...' : '全部已讀'}
          </button>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50 mt-4">
          <div className="mb-3 rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
            <Bell className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-bold">{tab === 'unread' ? '沒有未讀通知' : '目前沒有通知'}</h3>
          <p className="max-w-sm text-sm text-zinc-500">
            {tab === 'unread'
              ? '所有通知都已讀了。'
              : '當有人新增一筆需要您分攤的交易，或是公積金有大額支出時，會顯示在這裡。'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {visibleItems.map(n => (
            <div
              key={n.id}
              onClick={() => (selectMode ? toggleSelected(n.id) : handleNotificationClick(n))}
              className={`flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                selected.has(n.id) ? 'bg-blue-100/60 dark:bg-blue-900/20' : !n.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              }`}
            >
              <div className="mt-1 flex shrink-0 items-center justify-center">
                {selectMode ? (
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelected(n.id)}
                    onClick={e => e.stopPropagation()}
                    aria-label="選取這則通知"
                    className="h-5 w-5"
                  />
                ) : !n.isRead ? (
                  <div className="relative">
                    <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900"></span>
                  </div>
                ) : (
                  <Bell className="h-5 w-5 text-zinc-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className={`text-sm font-bold ${!n.isRead ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {n.title}
                  {n.edited && <span className="ml-2 text-xs font-normal text-zinc-400">已編輯</span>}
                </h4>
                <p className="mt-0.5 break-words text-sm text-zinc-600 dark:text-zinc-400">
                  {n.message}
                </p>
                <div className="mt-2 text-xs font-medium text-zinc-400">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {!selectMode && (
                <div className="flex shrink-0 items-center gap-1 self-center">
                  {/* 只切換已讀／未讀，不跳轉頁面 */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      runAction(() => setReadState([n.id], !n.isRead));
                    }}
                    disabled={busy}
                    title={n.isRead ? '標示為未讀' : '標示為已讀'}
                    aria-label={n.isRead ? '標示為未讀' : '標示為已讀'}
                    className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    {n.isRead ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </button>
                  {n.link && <ChevronRight className="h-5 w-5 text-zinc-400" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'all' && hasMore && (
        <div className="pt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          >
            {loadingMore ? '載入中...' : '載入更多通知'}
          </button>
        </div>
      )}

      {/* 選取模式的操作列：黏在畫面底部，不受手機底部導覽列顯示或隱藏的影響 */}
      {selectMode && (
        <div className="sticky bottom-20 z-30 mt-4 md:bottom-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">已選 {selected.size} 則</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleSelectAll}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                {allSelected ? '取消全選' : '全選'}
              </button>
              <button
                onClick={() => applySelection(true)}
                disabled={busy || selected.size === 0}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                標示已讀
              </button>
              {tab === 'all' && (
                <button
                  onClick={() => applySelection(false)}
                  disabled={busy || selected.size === 0}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  標示未讀
                </button>
              )}
            </div>
          </div>
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
