'use client';

import { useAuth } from '@/components/AuthProvider';
import { Settings, LayoutGrid, Bell } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { usePrivacy } from '@/components/PrivacyProvider';
import { PrivacyDropdown } from '@/components/PrivacyDropdown';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen to unread notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
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
    return null;
  }

  const mainTabs = [
    { name: '首頁', href: '/', emoji: '🏠' },
    { name: '發票', href: '/invoices', emoji: '🧾' },
    { name: '記帳', href: '/transactions/new', emoji: '➕', highlight: true },
    { name: '紀錄', href: '/transactions', emoji: '📝' },
    { name: '預算', href: '/budgets', emoji: '💰' },
  ];

  const moreFeatures = [
    { name: '共享帳本', href: '/ledgers', emoji: '👥' },
    { name: '存錢', href: '/saving-goals', emoji: '🎯' },
    { name: '報表', href: '/reports', emoji: '📊' },
  ];

  const isLedgerRoute = pathname.startsWith('/ledgers');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile Top Header */}
      <header className={`fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-800/80 md:hidden transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <span className="font-bold whitespace-nowrap text-lg">輕鬆記</span>
        
        <div className="flex items-center gap-2">
          <PrivacyDropdown variant="icon" />
          
          {/* More Features Link */}
          <Link 
            href="/more"
            className={`flex items-center gap-1 p-2 transition-colors ${pathname.startsWith('/more') ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'}`}
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>

          {/* Notification Bell */}
          <Link href="/notifications" className="relative p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-zinc-800">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <Link href="/settings" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 ml-1">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      {/* If it is a ledger route, we want to remove the bottom padding because the tab bar is hidden */}
      <main className={`flex-1 overflow-y-auto pt-14 md:pt-0 md:pb-0 md:pl-64 ${isLedgerRoute ? 'pb-0' : 'pb-20'}`}>
        <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 md:flex">
        <div className="flex h-16 items-center px-6">
          <span className="text-xl font-bold">輕鬆記 (FinTrack)</span>
        </div>
        <nav className="flex-1 space-y-1 p-4 mt-2 overflow-y-auto">
          <div className="space-y-1">
            <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">個人記帳</h3>
            {mainTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                  }`}
                >
                  <span className="text-lg">{tab.emoji}</span>
                  {tab.name}
                </Link>
              );
            })}
          </div>
          
          <div className="mt-8 space-y-1">
            <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">探索</h3>
            
            <Link
              href="/more"
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                pathname === '/more'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
              }`}
            >
              <LayoutGrid className="h-5 w-5" />
              更多功能
            </Link>

            <Link
              href="/notifications"
              className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                pathname === '/notifications'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔔</span>
                通知中心
              </div>
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </nav>
        
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2 shrink-0">
           <PrivacyDropdown variant="full" />
           <Link href="/settings" className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50">
             <Settings className="h-5 w-5" />
             設定
           </Link>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      {!isLedgerRoute && (
        <div className={`fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-zinc-200 bg-white/90 px-2 backdrop-blur-lg dark:border-zinc-700 dark:bg-zinc-800/90 md:hidden transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : 'translate-y-full'}`}>
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
      )}
    </div>
  );
}
