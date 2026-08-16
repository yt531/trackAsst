'use client';

import { useLedger } from '@/components/LedgerProvider';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ActivityFeedItem } from '@/types';
import { useAuth } from '@/components/AuthProvider';

export default function LedgerFeedPage() {
  const { activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      if (!activeLedgerId) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'ledgers', activeLedgerId, 'activityFeed'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityFeedItem)));
      } catch (err) {
        console.error('Error fetching feed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [activeLedgerId]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-zinc-500">載入動態中...</div>;
  }

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
                {item.actorId === user?.uid ? '我' : '友'}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.actorId === user?.uid ? '您' : `使用者 ${item.actorId.slice(0,4)}`} {item.details}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
