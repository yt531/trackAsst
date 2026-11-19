'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Pencil, Pin, X } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Announcement, LedgerMember } from '@/types';
import {
  cancelAnnouncement, createAnnouncement, editAnnouncement, fetchAnnouncements,
  getMemberName, isAnnouncementActive,
} from '@/lib/announcements';
import { isLedgerManagerRole } from '@/lib/notices';
import { requestPush } from '@/lib/push';

interface AnnouncementBoardProps {
  ledgerId: string;
  userId: string;
  members: LedgerMember[];
}

const formatTime = (ms: number) => new Date(ms).toLocaleString();

export function AnnouncementBoard({ ledgerId, userId, members }: AnnouncementBoardProps) {
  const isManager = isLedgerManagerRole(members.find(m => m.userId === userId)?.role);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState<Announcement | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      setAnnouncements(await fetchAnnouncements(ledgerId));
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  }, [ledgerId]);

  useEffect(() => { load(); }, [load]);

  // 每 30 秒重新判斷到期，時間到的公告會自動從公告區消失
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const active = announcements
    .filter(a => isAnnouncementActive(a, now))
    .sort((a, b) => a.order - b.order);
  const [first, ...rest] = active;

  const handleCancel = async (a: Announcement) => {
    if (!confirm('確定要取消這則公告嗎？公告會移到歷史公告，紀錄不會刪除。')) return;
    try {
      await cancelAnnouncement(a, userId);
      await load();
    } catch (err) {
      console.error('Failed to cancel announcement', err);
      alert('取消公告失敗');
    }
  };

  const renderCard = (a: Announcement) => (
    <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10">
      <p className="whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">{a.content}</p>
      <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
        <div>發佈人：{getMemberName(members, a.authorId, userId)}　{formatTime(a.createdAt)}</div>
        {a.updatedAt && <div>最後編輯：{formatTime(a.updatedAt)}</div>}
        <div>到期：{a.expiresAt ? formatTime(a.expiresAt) : '不會到期'}</div>
      </div>
      {isManager && (
        <div className="mt-2 flex gap-3">
          <button onClick={() => setComposing(a)} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Pencil className="h-3 w-3" />修改
          </button>
          <button onClick={() => handleCancel(a)} className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            <X className="h-3 w-3" />取消公告
          </button>
        </div>
      )}
    </div>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          <Pin className="h-5 w-5" />
          公告
        </h2>
        <div className="flex items-center gap-3">
          <Link href={`/ledgers/detail/announcements/history?id=${ledgerId}`} className="text-sm font-medium text-blue-600 dark:text-blue-400">
            歷史公告
          </Link>
          {isManager && (
            <button onClick={() => setComposing('new')} className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              發公告
            </button>
          )}
        </div>
      </div>

      {!first ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
          目前沒有公告
        </p>
      ) : (
        <div className="space-y-3">
          {renderCard(first)}
          {rest.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-center gap-1 text-sm font-medium text-zinc-500"
              >
                {expanded ? '收合' : `展開其他 ${rest.length} 則公告`}
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && rest.map(renderCard)}
            </>
          )}
        </div>
      )}

      {composing && (
        <AnnouncementComposer
          ledgerId={ledgerId}
          userId={userId}
          editing={composing === 'new' ? null : composing}
          onClose={() => setComposing(null)}
          onDone={async () => { setComposing(null); await load(); }}
        />
      )}
    </section>
  );
}

interface ComposerProps {
  ledgerId: string;
  userId: string;
  editing: Announcement | null;
  onClose: () => void;
  onDone: () => void;
}

function AnnouncementComposer({ ledgerId, userId, editing, onClose, onDone }: ComposerProps) {
  const [content, setContent] = useState(editing?.content ?? '');
  const [expires, setExpires] = useState(
    editing?.expiresAt ? format(new Date(editing.expiresAt), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    const expiresAt = expires ? new Date(expires).getTime() : null;
    if (expiresAt !== null && expiresAt <= Date.now()) {
      alert('到期時間必須晚於現在');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await editAnnouncement(editing, content.trim(), expiresAt);
      } else {
        const announcementId = await createAnnouncement(ledgerId, userId, content.trim(), expiresAt ?? undefined);
        void requestPush('announcement', ledgerId, announcementId); // 推播失敗不影響發佈
      }
      onDone();
    } catch (err) {
      console.error('Failed to submit announcement', err);
      alert(editing ? '修改失敗' : '發佈失敗');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{editing ? '修改公告' : '發公告'}</h3>
          <button onClick={onClose} aria-label="關閉"><X className="h-5 w-5" /></button>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="輸入公告內容..."
          className="min-h-[100px] w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label className="mt-3 block text-sm font-medium">到期時間（選填，空白代表不會到期）</label>
        <input
          type="datetime-local"
          value={expires}
          onChange={e => setExpires(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-zinc-200 py-2.5 font-semibold dark:border-zinc-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? '處理中...' : editing ? '儲存修改' : '發佈'}
          </button>
        </div>
      </div>
    </div>
  );
}
