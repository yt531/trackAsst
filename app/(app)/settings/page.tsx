'use client';

import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { DataExportImport } from '@/components/settings/DataExportImport';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { Fingerprint } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          管理您的應用程式偏好設定與資料。
        </p>
      </header>

      <section>
        <AppearanceSettings />
      </section>

      <section>
        <NotificationSettings />
      </section>

      <section>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">財務</h2>
          <Link href="/settings/payment-methods" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <div className="font-medium">支付方式管理</div>
                <div className="text-sm text-zinc-500">新增或修改您的銀行帳戶、電子支付與信用卡</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>
        </div>
      </section>

      <section>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">安全性</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <Fingerprint className="h-5 w-5 text-zinc-500" />
                </div>
                <div>
                  <div className="font-medium">生物辨識解鎖</div>
                  <div className="text-sm text-zinc-500">需要 Face ID / Touch ID 才能開啟應用程式</div>
                </div>
              </div>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                 <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition" />
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400">注意：生物辨識需要 WebAuthn，將在未來的更新中提供。</p>
          </div>
        </div>
      </section>

      <section>
        <DataExportImport />
      </section>

    </div>
  );
}
