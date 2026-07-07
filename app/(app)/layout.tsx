'use client';

import { useAuth } from '@/components/AuthProvider';
import { Home, List, PieChart, ScanLine, WalletCards, Settings, LogOut, Target, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="flex h-screen items-center justify-center">載入中...</div>;
  }

  if (!user) {
    return null; // Will redirect in AuthProvider
  }

  const tabs = [
    { name: '首頁', href: '/', icon: Home },
    { name: '紀錄', href: '/transactions', icon: List },
    { name: '發票', href: '/invoices', icon: WalletCards },
    { name: '預算', href: '/budgets', icon: Wallet },
    { name: '掃描', href: '/invoices/scan', icon: ScanLine, highlight: true },
    { name: '存錢', href: '/saving-goals', icon: Target },
    { name: '報表', href: '/reports', icon: PieChart },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
        <span className="font-bold">FinTrack</span>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
            <Settings className="h-5 w-5" />
          </Link>
          <button 
            onClick={() => signOut(auth)}
            className="text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-4xl p-4 md:p-8">{children}</div>
      </main>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <div className="flex h-16 items-center px-6">
          <span className="text-xl font-bold">FinTrack</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
           <Link href="/settings" className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50">
             <Settings className="h-5 w-5" />
             設定
           </Link>
           <button 
             onClick={() => signOut(auth)}
             className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
           >
             <LogOut className="h-5 w-5" />
             登出
           </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-zinc-200 bg-white/80 px-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 md:hidden">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center p-2 ${
                tab.highlight
                  ? '-mt-6 rounded-full bg-blue-600 p-4 text-white shadow-lg dark:bg-blue-500'
                  : isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              <tab.icon className={tab.highlight ? 'h-6 w-6' : 'h-5 w-5'} />
              {!tab.highlight && <span className="mt-1 text-[10px] font-medium">{tab.name}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
