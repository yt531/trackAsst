'use client';

import { useEffect, useState } from 'react';
import { ConfirmRequest, registerConfirmHost } from '@/lib/confirm';

// 掛在根版面一次，負責顯示 confirmAsync() 發出的確認視窗；同時有多個請求時依序顯示
export function ConfirmHost() {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);

  useEffect(() => registerConfirmHost(request => setQueue(prev => [...prev, request])), []);

  const current = queue[0];

  const answer = (confirmed: boolean) => {
    if (!current) return;
    current.resolve(confirmed);
    setQueue(prev => prev.slice(1));
  };

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;

  // 刪除、移除、退出這類操作，確認鈕用紅色提醒
  const destructive = /刪除|移除|退出|放棄/.test(current.message);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={() => answer(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">請確認</h3>
        <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-600 dark:text-zinc-400">
          {current.message}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => answer(false)}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 font-semibold transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            onClick={() => answer(true)}
            autoFocus
            className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
