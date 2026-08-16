'use client';

import { useLedger } from '@/components/LedgerProvider';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Search, Plus, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LedgersHubPage() {
  const { ledgers, isLoading } = useLedger();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">載入帳本中...</div>;
  }

  const filteredLedgers = ledgers.filter(ledger => 
    ledger.name.toLowerCase().includes(searchQuery.toLowerCase()) && ledger.type === 'shared'
  );

  return (
    <div className="relative min-h-screen pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">共享帳本</h1>
        <p className="text-sm text-zinc-500">管理與您朋友共用的帳本</p>
      </header>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-zinc-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋帳本..."
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      {/* Ledger List */}
      {filteredLedgers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="mb-3 rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
            <Users className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold">還沒有任何共享帳本</h3>
          <p className="mb-6 max-w-sm text-sm text-zinc-500">
            建立一個新的共享帳本，或是請朋友發送邀請連結給您。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredLedgers.map((ledger) => (
            <button
              key={ledger.id}
              onClick={() => router.push(`/ledgers/detail?id=${ledger.id}`)}
              className="group flex flex-col items-start justify-between rounded-2xl border border-zinc-200 bg-white p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="mb-4 flex w-full items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <Wallet className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {ledger.mode === 'split' ? '分帳模式' : '公積金模式'}
                </span>
              </div>
              <h3 className="mb-1 text-lg font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {ledger.name}
              </h3>
              <p className="text-sm text-zinc-500">
                {ledger.currency}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* FAB - Create New Ledger */}
      <button
        onClick={() => router.push('/settings/ledgers/new')}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95 md:bottom-12 md:right-12"
        aria-label="新增共享帳本"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
