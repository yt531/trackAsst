'use client';

import { Fingerprint, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SecurityPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">安全性管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            管理應用程式的安全設定
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Fingerprint className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">生物辨識解鎖</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">需要 Face ID / Touch ID 才能開啟應用程式</div>
              </div>
            </div>
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-200 dark:bg-zinc-700">
               <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition" />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-400">注意：生物辨識需要 WebAuthn，將在未來的更新中提供。</p>
        </div>
      </section>
    </div>
  );
}
