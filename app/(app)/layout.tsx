'use client';

import { useAuth } from '@/components/AuthProvider';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsNavVisible(false); // hide when scrolling down
      } else {
        setIsNavVisible(true); // show when scrolling up
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">載入中...</div>;
  }

  if (!user) {
    return null; // Will redirect in AuthProvider
  }

  const mainTabs = [
    { name: '首頁', href: '/', emoji: '🏠' },
    { name: '發票', href: '/invoices', emoji: '🧾' },
    { name: '記帳', href: '/transactions/new', emoji: '➕', highlight: true },
    { name: '紀錄', href: '/transactions', emoji: '📝' },
    { name: '預算', href: '/budgets', emoji: '💰' },
  ];

  const topTabs = [
    { name: '存錢', href: '/saving-goals', emoji: '🎯' },
    { name: '報表', href: '/reports', emoji: '📊' },
  ];

  const allTabs = [...mainTabs, ...topTabs];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile Top Header */}
      <header className={`fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 md:hidden transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <span className="font-bold">輕鬆記</span>
        <div className="flex items-center gap-4">
          {topTabs.map(tab => (
             <Link key={tab.name} href={tab.href} className={`text-sm font-medium transition-colors ${pathname === tab.href ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'}`}>
               {tab.name}
             </Link>
          ))}
          <Link href="/settings" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 ml-2">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pt-14 pb-20 md:pt-0 md:pb-0 md:pl-64">
        <div className="mx-auto max-w-4xl p-4 md:p-8">{children}</div>
      </main>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <div className="flex h-16 items-center px-6">
          <span className="text-xl font-bold">輕鬆記 (FinTrack)</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {allTabs.map((tab) => {
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
                <span className="text-lg">{tab.emoji}</span>
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
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <div className={`fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-zinc-200 bg-white/90 px-2 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/90 md:hidden transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        {mainTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center p-2 relative ${
                tab.highlight
                  ? '-mt-8 rounded-full bg-blue-50 p-3 shadow-lg border-4 border-white dark:border-zinc-950 dark:bg-blue-900/30'
                  : isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              <span className={tab.highlight ? 'text-2xl drop-shadow-md' : 'text-xl'}>{tab.emoji}</span>
              {!tab.highlight && <span className="mt-1 text-[10px] font-medium">{tab.name}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
