'use client';

import { useEffect, useState } from 'react';
import { ToastRequest, registerToastHost } from '@/lib/toast';

// 提示顯示在頂部標題列（h-14 = 3.5rem）下方，避免蓋住返回鈕
// 掛在根版面一次，負責顯示 showToast() 發出的提示；可同時顯示多則，點擊或時間到即消失
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastRequest[]>([]);

  const dismiss = (toast: ToastRequest) => {
    toast.resolve();
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  useEffect(() => registerToastHost(toast => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      toast.resolve();
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, toast.duration);
  }), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[110] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+4rem)]">
      {toasts.map(toast => {
        // 失敗、錯誤、無權限這類訊息用紅色提醒
        const isError = /失敗|錯誤|無法|無權限|不可|不能/.test(toast.message);
        return (
          <div
            key={toast.id}
            role="alert"
            onClick={() => dismiss(toast)}
            className={`pointer-events-auto w-full max-w-sm cursor-pointer whitespace-pre-line break-words rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              isError ? 'bg-[#C00000]' : 'bg-zinc-800 dark:bg-zinc-700'
            }`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
