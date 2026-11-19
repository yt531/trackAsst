'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { hasUnsyncedWrites, logout, switchAccount } from '@/lib/account';

interface AccountActionDialogProps {
  mode: 'logout' | 'switch';
  onClose: () => void;
}

const COPY = {
  logout: {
    title: '登出',
    description: '登出後會清除此裝置上的鎖定設定（PIN 會在下次登入從雲端還原，生物辨識需重新設定）與離線快取。',
    action: '登出',
    forceAction: '仍要登出',
  },
  switch: {
    title: '切換帳號',
    description: '將開啟 Google 帳號選擇畫面。選好新帳號後，會清除此裝置上屬於目前帳號的鎖定設定與離線快取；取消選擇則維持目前帳號。',
    action: '選擇其他帳號',
    forceAction: '仍要切換',
  },
} as const;

export function AccountActionDialog({ mode, onClose }: AccountActionDialogProps) {
  const copy = COPY[mode];
  const [unsynced, setUnsynced] = useState<boolean | null>(null); // null = 檢查中
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    hasUnsyncedWrites().then(result => { if (!cancelled) setUnsynced(result); });
    return () => { cancelled = true; };
  }, []);

  // 切換帳號必須在這次點擊中直接開啟 Google 視窗，因此這裡不能先 await 其他事情
  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'logout') {
        await logout();
      } else if (await switchAccount() === 'same') {
        setMessage('您選擇的是目前登入的帳號，沒有變更。');
        setBusy(false);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // 使用者自行關閉 Google 視窗不算錯誤
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Account action failed', err);
        setMessage(mode === 'logout' ? '登出失敗，請稍後再試。' : '切換帳號失敗，請稍後再試。');
      }
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h3 className="text-lg font-bold">{copy.title}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{copy.description}</p>

        {unsynced === null && <p className="mt-3 text-xs text-zinc-500">正在檢查資料是否已同步...</p>}
        {unsynced && (
          <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>偵測到有尚未同步到雲端的資料（可能目前離線），繼續將會遺失這些資料。</span>
          </div>
        )}
        {message && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{message}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 font-semibold disabled:opacity-50 dark:border-zinc-700"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || unsynced === null}
            className={`flex-1 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50 ${
              unsynced || mode === 'logout' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy ? '處理中...' : unsynced ? copy.forceAction : copy.action}
          </button>
        </div>
      </div>
    </div>
  );
}
