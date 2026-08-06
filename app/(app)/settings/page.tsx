'use client';

import { Fingerprint, User, Palette, LogOut, Tags, Bell, Shield, Database } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function SettingsPage() {
  return (
    <div className="space-y-8 pb-20">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          管理您的應用程式偏好設定與資料。
        </p>
      </header>

      <section>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">一般</h2>
          
          <Link href="/settings/account" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <User className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">帳號管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">查看您的使用者資訊與登入方式</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>

          <Link href="/settings/appearance" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Palette className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">外觀 (色彩模式)</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">切換淺色、深色或跟隨系統設定</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>

          <Link href="/settings/notifications" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">通知與提醒管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">管理應用程式的推播通知</div>
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
          <h2 className="text-lg font-semibold">財務</h2>
          
          <Link href="/settings/payment-methods" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <div className="font-medium">支付方式管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">新增或修改您的銀行帳戶、電子支付與信用卡</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>

          <Link href="/settings/categories" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Tags className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">交易分類管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">新增或修改您的交易分類</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>

          <Link href="/settings/tags" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Tags className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">標籤管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">新增或修改您的交易標籤</div>
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
          <h2 className="text-lg font-semibold">進階</h2>

          <Link href="/settings/security" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Shield className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">安全性管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">管理應用程式的安全設定</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>

          <Link href="/settings/data" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Database className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">資料管理</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">匯出或匯入您的應用程式資料</div>
              </div>
            </div>
            <div className="text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </Link>
        </div>
      </section>

      <section className="pt-4">
        <button 
          onClick={() => signOut(auth)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-4 font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          登出
        </button>
      </section>
    </div>
  );
}
