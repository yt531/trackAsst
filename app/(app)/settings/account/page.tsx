'use client';

import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, User as UserIcon, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  // Determine login method
  let loginMethod = '未知方式';
  if (user.providerData && user.providerData.length > 0) {
    const providerId = user.providerData[0].providerId;
    if (providerId === 'google.com') loginMethod = 'Google 帳戶';
    else if (providerId === 'password') loginMethod = '電子郵件與密碼';
    else loginMethod = providerId;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">帳號管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            查看您的使用者資訊與登入方式
          </p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-6">
            
            {/* Username */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <UserIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">使用者名稱</p>
                <p className="text-lg font-semibold">{user.displayName || '未設定名稱'}</p>
              </div>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* Email */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">電子郵件</p>
                <p className="text-lg font-semibold">{user.email || '無電子郵件'}</p>
              </div>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* Login Method */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">目前登入方式</p>
                <p className="text-lg font-semibold">{loginMethod}</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
