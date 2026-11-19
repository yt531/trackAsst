'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { LedgerMember, LedgerNotice } from '@/types';
import { getLedgerMembers } from '@/lib/ledger';
import { fetchNotices, isLedgerManagerRole } from '@/lib/notices';
import { getMemberName } from '@/lib/announcements';

const formatTime = (ms?: number) => (ms ? new Date(ms).toLocaleString() : '—');

export default function NoticeHistoryPage() {
  const { activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [items, setItems] = useState<LedgerNotice[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const isManager = isLedgerManagerRole(members.find(m => m.userId === user?.uid)?.role);

  useEffect(() => {
    if (!activeLedgerId || !user) return;
    (async () => {
      try {
        const m = await getLedgerMembers(activeLedgerId);
        setMembers(m);
        // 已刪除的通知只有管理員讀得到，因此非管理員不需要載入
        if (isLedgerManagerRole(m.find(x => x.userId === user.uid)?.role)) {
          const all = await fetchNotices(activeLedgerId, user.uid, true);
          setItems(all.filter(n => n.deleted).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)));
        }
      } catch (err) {
        console.error('Error loading notice history:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLedgerId, user]);

  const nameOf = (uid: string) => getMemberName(members, uid, user?.uid ?? '');

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(n =>
      n.content.toLowerCase().includes(kw) ||
      getMemberName(members, n.authorId, user?.uid ?? '').toLowerCase().includes(kw)
    );
  }, [items, keyword, members, user?.uid]);

  if (loading) return <div className="p-8 text-center text-sm text-zinc-500">載入中...</div>;
  if (!isManager) return <div className="p-8 text-center text-sm text-zinc-500">只有管理員可以查看歷史通知</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">歷史通知</h1>
      <p className="text-sm text-zinc-500">已刪除的管理員通知。收件人看不到這些紀錄。</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜尋內容或發佈人"
          className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {items.length === 0 ? '目前沒有已刪除的通知' : '找不到符合的通知'}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map(n => (
            <div key={n.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">{n.content}</p>
              <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                <div>發佈人：{nameOf(n.authorId)}</div>
                <div className="break-words">
                  對象：{n.mentionAll ? '@全體' : n.mentionedIds.map(id => `@${nameOf(id)}`).join(' ')}
                </div>
                <div>發佈時間：{formatTime(n.createdAt)}</div>
                <div>最後編輯：{formatTime(n.updatedAt)}</div>
                <div>刪除時間：{formatTime(n.deletedAt)}　刪除人：{n.deletedBy ? nameOf(n.deletedBy) : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
