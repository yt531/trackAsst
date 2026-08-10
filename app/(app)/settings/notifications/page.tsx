'use client';

import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通知與提醒管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            管理應用程式的推播通知
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">收不到通知嗎？</span><br/>
            此處為應用程式內的通知偏好設定。若您無法收到通知，請確保已在 <Link href="/settings/permissions" className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100">權限管理</Link> 中開啟裝置底層的通知權限。
          </div>
        </div>
      </div>

      <section>
        <NotificationSettings />
      </section>
    </div>
  );
}
