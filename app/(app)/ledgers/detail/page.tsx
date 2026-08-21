'use client';

import { useLedger } from '@/components/LedgerProvider';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { ActivityFeedItem, LedgerMember } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { getLedgerMembers } from '@/lib/ledger';

export default function LedgerFeedPage() {
  const { activeLedgerId, activeLedger } = useLedger();
  const { user } = useAuth();
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [members, setMembers] = useState<Record<string, LedgerMember>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      if (!activeLedgerId) return;
      setLoading(true);
      try {
        const conditions: any[] = [orderBy('timestamp', 'desc'), limit(20)];
        if (activeLedger?.feedHiddenUntil) {
          conditions.unshift(where('timestamp', '>=', activeLedger.feedHiddenUntil));
        }

        const q = query(
          collection(db, 'ledgers', activeLedgerId, 'activityFeed'),
          ...conditions
        );
        const snap = await getDocs(q);
        setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityFeedItem)));
        setLastVisible(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === 20);

        const ledgerMembers = await getLedgerMembers(activeLedgerId);
        const membersMap = ledgerMembers.reduce((acc, m) => {
          acc[m.userId] = m;
          return acc;
        }, {} as Record<string, LedgerMember>);
        setMembers(membersMap);
      } catch (err) {
        console.error('Error fetching feed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [activeLedgerId, activeLedger?.feedHiddenUntil]);

  const handleLoadMore = async () => {
    if (!activeLedgerId || !lastVisible) return;
    setLoadingMore(true);
    try {
      const conditions: any[] = [
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(20)
      ];
      if (activeLedger?.feedHiddenUntil) {
        conditions.unshift(where('timestamp', '>=', activeLedger.feedHiddenUntil));
      }

      const q = query(
        collection(db, 'ledgers', activeLedgerId, 'activityFeed'),
        ...conditions
      );
      const snap = await getDocs(q);
      const newItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityFeedItem));
      
      setFeed(prev => [...prev, ...newItems]);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === 20);
    } catch (err) {
      console.error('Error fetching more feed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading && feed.length === 0) {
    return <div className="p-8 text-center text-sm text-zinc-500">載入動態中...</div>;
  }

  const getActorName = (actorId: string) => {
    if (actorId === user?.uid) return '您';
    const member = members[actorId];
    if (member?.nickname) return member.nickname;
    if (member?.role === 'admin') return '管理員';
    return `使用者 ${actorId.slice(0, 4)}`;
  };

  return (
    <div className="space-y-4">
      {feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50 mt-4">
          <div className="mb-3 rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
            <Clock className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold">目前沒有任何動態</h3>
          <p className="max-w-sm text-sm text-zinc-500">
            新增一筆共享交易或邀請成員加入，這裡就會顯示最新的活動紀錄。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map(item => (
            <div key={item.id} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                {item.actorId === user?.uid ? '我' : getActorName(item.actorId).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.type === 'member_joined' 
                    ? item.details 
                    : item.type === 'transaction_created'
                      ? `${getActorName(item.actorId)}：新增了一筆交易，金額為 ${item.details}。`
                      : item.type === 'transaction_updated'
                        ? `${getActorName(item.actorId)}：修改了一筆交易，金額為 ${item.details}。`
                        : item.type === 'transaction_deleted'
                          ? `${getActorName(item.actorId)}：刪除了一筆交易${item.details ? `，金額為 ${item.details}` : ''}。`
                          : `${getActorName(item.actorId)} ${item.details}`}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="pt-4 text-center">
              <button 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
              >
                {loadingMore ? '載入中...' : '載入更多動態'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
