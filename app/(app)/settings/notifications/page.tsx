'use client';

import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

      <section>
        <NotificationSettings />
      </section>
    </div>
  );
}
