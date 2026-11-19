'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { Announcement, LedgerMember } from '@/types';
import { getLedgerMembers } from '@/lib/ledger';
import { fetchAnnouncements, getMemberName, getTakedownAt, isAnnouncementActive } from '@/lib/announcements';

const formatTime = (ms?: number) => (ms ? new Date(ms).toLocaleString() : '—');

export default function AnnouncementHistoryPage() {
  const { activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [items, setItems] = useState<Announcement[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLedgerId) return;
    (async () => {
      try {
        const [m, all] = await Promise.all([getLedgerMembers(activeLedgerId), fetchAnnouncements(activeLedgerId)]);
        setMembers(m);
        const now = Date.now();
        // 歷史公告 = 已取消或已到期，依下架時間由近到遠
        setItems(
          all
            .filter(a => !isAnnouncementActive(a, now))
            .sort((a, b) => (getTakedownAt(b) ?? 0) - (getTakedownAt(a) ?? 0))
        );
      } catch (err) {
        console.error('Error loading announcement history:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLedgerId]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(a =>
      a.content.toLowerCase().includes(kw) ||
      getMemberName(members, a.authorId, user?.uid ?? '').toLowerCase().includes(kw)
    );
  }, [items, keyword, members, user?.uid]);

  if (loading) return <div className="p-8 text-center text-sm text-zinc-500">載入中...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">歷史公告</h1>
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
          {items.length === 0 ? '目前沒有歷史公告' : '找不到符合的公告'}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map(a => (
            <div key={a.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">{a.content}</p>
              <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
                <div>發佈人：{getMemberName(members, a.authorId, user?.uid ?? '')}</div>
                <div>發佈時間：{formatTime(a.createdAt)}</div>
                <div>最後編輯：{formatTime(a.updatedAt)}</div>
                <div>下架時間：{formatTime(getTakedownAt(a))}（{a.status === 'cancelled' ? '管理員取消' : '已到期'}）</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
