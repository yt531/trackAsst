'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { Announcement, LedgerMember } from '@/types';
import { getLedgerMembers } from '@/lib/ledger';
import { isLedgerManagerRole } from '@/lib/notices';
import { fetchAnnouncements, getMemberName, isAnnouncementActive, reorderAnnouncements } from '@/lib/announcements';
import { showToast } from '@/lib/toast';

export default function AnnouncementOrderPage() {
  const { activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeLedgerId) return;
    try {
      const [m, all] = await Promise.all([getLedgerMembers(activeLedgerId), fetchAnnouncements(activeLedgerId)]);
      setMembers(m);
      const now = Date.now();
      setItems(all.filter(a => isAnnouncementActive(a, now)).sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [activeLedgerId]);

  useEffect(() => { load(); }, [load]);

  const isManager = isLedgerManagerRole(members.find(m => m.userId === user?.uid)?.role);

  const move = async (index: number, delta: -1 | 1) => {
    if (!activeLedgerId || saving) return;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setSaving(true);
    try {
      await reorderAnnouncements(activeLedgerId, next.map(a => a.id));
    } catch (err) {
      console.error('Failed to reorder announcements', err);
      showToast('排序儲存失敗');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-zinc-500">載入中...</div>;
  if (!isManager) return <div className="p-8 text-center text-sm text-zinc-500">只有管理員可以調整公告順序</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">公告排序</h1>
        <p className="text-sm text-zinc-500">動態時報會依這裡的順序顯示，最上面的公告會固定顯示，其餘收合。</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          目前沒有顯示中的公告
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <span className="w-5 shrink-0 text-center text-sm font-bold text-zinc-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-sm text-zinc-900 dark:text-zinc-100">{a.content}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {getMemberName(members, a.authorId, user?.uid ?? '')}　{new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || saving}
                  aria-label="上移"
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-700"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1 || saving}
                  aria-label="下移"
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-700"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
