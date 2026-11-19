'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Pencil, Search, Trash2, X } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { LedgerMember, LedgerNotice } from '@/types';
import { deleteNotice, editNotice, fetchNotices, isLedgerManagerRole, sendNotice } from '@/lib/notices';

interface NoticeBoardProps {
  ledgerId: string;
  ledgerName: string;
  userId: string;
  members: LedgerMember[];
}

export function NoticeBoard({ ledgerId, ledgerName, userId, members }: NoticeBoardProps) {
  const myRole = members.find(m => m.userId === userId)?.role;
  const isManager = isLedgerManagerRole(myRole);

  const [notices, setNotices] = useState<LedgerNotice[]>([]);
  const [keyword, setKeyword] = useState('');
  const [composing, setComposing] = useState<LedgerNotice | 'new' | null>(null);

  const nameOf = useCallback((uid: string) => {
    if (uid === userId) return '您';
    return members.find(m => m.userId === uid)?.nickname || `使用者 ${uid.slice(0, 4)}`;
  }, [members, userId]);

  const load = useCallback(async () => {
    try {
      setNotices(await fetchNotices(ledgerId, userId, isManager));
    } catch (err) {
      console.error('Error fetching notices:', err);
    }
  }, [ledgerId, userId, isManager]);

  useEffect(() => {
    if (members.length > 0) load();
  }, [load, members.length]);

  // 已刪除的通知（僅管理員讀得到）移到「歷史通知」頁，這裡只顯示有效通知
  const activeNotices = useMemo(() => notices.filter(n => !n.deleted), [notices]);

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return activeNotices;
    return activeNotices.filter(n =>
      n.content.toLowerCase().includes(kw) || nameOf(n.authorId).toLowerCase().includes(kw)
    );
  }, [activeNotices, keyword, nameOf]);

  const handleDelete = async (notice: LedgerNotice) => {
    if (!confirm('確定要刪除這則通知嗎？紀錄會保留，但對方將不再看到。')) return;
    try {
      await deleteNotice(notice, userId);
      await load();
    } catch (err) {
      console.error('Failed to delete notice', err);
      alert('刪除失敗');
    }
  };

  // 一般成員且沒有任何可見通知時不佔版面
  if (!isManager && activeNotices.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          <Megaphone className="h-5 w-5" />
          管理員通知
        </h2>
        {isManager && (
          <div className="flex items-center gap-3">
            <Link href={`/ledgers/detail/notices/history?id=${ledgerId}`} className="text-sm font-medium text-blue-600 dark:text-blue-400">
              歷史通知
            </Link>
            <button
              onClick={() => setComposing('new')}
              className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              發通知
            </button>
          </div>
        )}
      </div>

      {activeNotices.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜尋內容或發佈人"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(n => (
          <div
            key={n.id}
            className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/30 dark:bg-blue-900/10"
          >
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">{n.content}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span>{nameOf(n.authorId)}</span>
              <span>{new Date(n.createdAt).toLocaleString()}</span>
              {n.updatedAt && <span>已編輯 {new Date(n.updatedAt).toLocaleString()}</span>}
            </div>
            <div className="mt-1 text-xs text-zinc-500 break-words">
              對象：{n.mentionAll ? '@全體' : n.mentionedIds.map(id => `@${nameOf(id)}`).join(' ')}
            </div>
            {isManager && (
              <div className="mt-2 flex gap-3">
                <button onClick={() => setComposing(n)} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <Pencil className="h-3 w-3" />修改
                </button>
                <button onClick={() => handleDelete(n)} className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <Trash2 className="h-3 w-3" />刪除
                </button>
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && activeNotices.length > 0 && (
          <p className="py-4 text-center text-sm text-zinc-500">找不到符合的通知</p>
        )}
      </div>

      {composing && (
        <NoticeComposer
          ledgerId={ledgerId}
          ledgerName={ledgerName}
          userId={userId}
          members={members}
          editing={composing === 'new' ? null : composing}
          nameOf={nameOf}
          onClose={() => setComposing(null)}
          onDone={async () => { setComposing(null); await load(); }}
        />
      )}
    </section>
  );
}

interface NoticeComposerProps extends NoticeBoardProps {
  editing: LedgerNotice | null;
  nameOf: (uid: string) => string;
  onClose: () => void;
  onDone: () => void;
}

function NoticeComposer({ ledgerId, ledgerName, userId, members, editing, nameOf, onClose, onDone }: NoticeComposerProps) {
  const [content, setContent] = useState(editing?.content ?? '');
  const [mentionAll, setMentionAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 修改時不能變更對象（已送出的副本不會改變），因此只編輯內容
  const canSubmit = content.trim() && (editing || mentionAll || selectedIds.length > 0);
  const targets = members.filter(m => m.userId !== userId);

  const toggle = (uid: string) =>
    setSelectedIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (editing) {
        await editNotice(editing, content.trim());
      } else {
        await sendNotice({
          ledgerId, ledgerName, authorId: userId, content: content.trim(),
          mentionAll, mentionedIds: selectedIds, members,
        });
      }
      onDone();
    } catch (err) {
      console.error('Failed to submit notice', err);
      alert(editing ? '修改失敗' : '發送失敗');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{editing ? '修改通知' : '發通知'}</h3>
          <button onClick={onClose} aria-label="關閉"><X className="h-5 w-5" /></button>
        </div>

        {editing ? (
          <p className="mb-3 text-sm text-zinc-500">
            對象：{editing.mentionAll ? '@全體' : editing.mentionedIds.map(id => `@${nameOf(id)}`).join(' ')}（修改後會重新通知對方）
          </p>
        ) : (
          <div className="mb-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={mentionAll} onChange={e => setMentionAll(e.target.checked)} />
              @全體成員
            </label>
            {!mentionAll && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                {targets.length === 0 && <p className="text-sm text-zinc-500">沒有其他成員</p>}
                {targets.map(m => (
                  <label key={m.userId} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedIds.includes(m.userId)} onChange={() => toggle(m.userId)} />
                    @{nameOf(m.userId)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="輸入通知內容..."
          className="min-h-[100px] w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 font-semibold dark:border-zinc-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? '處理中...' : editing ? '儲存修改' : '發送'}
          </button>
        </div>
      </div>
    </div>
  );
}
