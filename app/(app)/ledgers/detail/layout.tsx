'use client';

import { useLedger } from '@/components/LedgerProvider';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, ChevronLeft, List, Calculator, Settings } from 'lucide-react';
import { useEffect, useState, Suspense } from 'react';
import { Ledger } from '@/types';
import { getLedger } from '@/lib/ledger';

function LedgerDetailLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ledgerId = searchParams.get('id');
  const { setActiveLedgerId } = useLedger();
  
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      if (!ledgerId) {
        router.push('/ledgers');
        return;
      }
      const data = await getLedger(ledgerId);
      if (data) {
        setLedger(data);
        setActiveLedgerId(ledgerId); // Sync global context
      } else {
        router.push('/ledgers');
      }
      setLoading(false);
    };
    fetchLedger();
  }, [ledgerId, router, setActiveLedgerId]);

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">載入帳本中...</div>;
  }

  if (!ledger) return null;

  const tabs = [
    { name: '動態時報', href: `/ledgers/detail?id=${ledgerId}`, icon: List },
    { name: '結算餘額', href: `/ledgers/detail/balances?id=${ledgerId}`, icon: Calculator },
    { name: '帳本設定', href: `/ledgers/detail/settings?id=${ledgerId}`, icon: Settings },
  ];

  return (
    <div className="relative min-h-screen pb-24">
      {/* Top Header area for the specific ledger */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => router.push('/ledgers')}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors -ml-2"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{ledger.name}</h1>
            <p className="text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full inline-block mt-1">
              {ledger.mode === 'split' ? '分帳模式' : '公積金模式'}
            </p>
          </div>
        </div>

        {/* Top Tabs (Desktop only) */}
        <div className="hidden md:flex gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-4">
        {children}
      </div>

      {/* FAB - Add Transaction (Hidden on settings page) */}
      {!pathname.endsWith('/settings') && !pathname.endsWith('/transactions/new') && (
        <button
          onClick={() => router.push(`/ledgers/detail/transactions/new?id=${ledgerId}`)}
          className="fixed bottom-20 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95 md:bottom-8 md:right-8 z-50"
          aria-label="新增交易"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Bottom Navigation Bar (Mobile only) */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-zinc-200 bg-white/90 px-2 backdrop-blur-lg dark:border-zinc-700 dark:bg-zinc-800/90 md:hidden">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center p-2 relative ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="mt-1 text-[10px] font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function LedgerDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center">載入中...</div>}>
      <LedgerDetailLayoutContent>{children}</LedgerDetailLayoutContent>
    </Suspense>
  );
}
