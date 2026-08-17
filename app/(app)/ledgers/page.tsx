'use client';

import { useLedger } from '@/components/LedgerProvider';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Search, Plus, Users, Wallet, QrCode, X, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { PageHeader } from '@/components/PageHeader';

export default function LedgersHubPage() {
  const { ledgers, isLoading } = useLedger();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'menu' | 'join'>('menu');
  const [inviteCode, setInviteCode] = useState('');
  const router = useRouter();

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">載入帳本中...</div>;
  }

  const filteredLedgers = ledgers.filter(ledger => 
    ledger.name.toLowerCase().includes(searchQuery.toLowerCase()) && ledger.type === 'shared'
  );

  return (
    <div className="relative min-h-screen pb-24">
      <PageHeader title="共享帳本" backHref="/more" />
      <header className="hidden md:block mb-6">
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

      {/* FAB - Open Bottom Sheet */}
      <button
        onClick={() => {
          setSheetMode('menu');
          setIsSheetOpen(true);
        }}
        className="fixed bottom-24 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 hover:bg-blue-700 active:scale-95 md:bottom-12 md:right-12"
        aria-label="新增共享帳本"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSheetOpen(false)}
              className="fixed inset-0 z-[60] bg-zinc-900/50 backdrop-blur-sm"
            />

            {/* Sheet Content */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2 md:border md:border-zinc-200 md:dark:border-zinc-800"
            >
              {/* Handle bar for mobile */}
              <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700 md:hidden" />

              {sheetMode === 'menu' ? (
                <div className="space-y-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="w-10"></div> {/* Spacer for center alignment */}
                    <h3 className="text-lg font-bold">要進行什麼操作？</h3>
                    <button
                      onClick={() => setIsSheetOpen(false)}
                      className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsSheetOpen(false);
                      router.push('/ledgers/new');
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl bg-blue-50 p-4 text-left transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-900 dark:text-blue-100">建立共享帳本</h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300">建立一個新的帳本並邀請朋友</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSheetMode('join')}
                    className="flex w-full items-center gap-4 rounded-2xl bg-zinc-50 p-4 text-left transition-colors hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 shadow-sm dark:bg-zinc-700 dark:text-zinc-300">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100">加入共享帳本</h4>
                      <p className="text-xs text-zinc-500">輸入邀請碼或掃描 QR Code 加入</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <button
                      onClick={() => setSheetMode('menu')}
                      className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h3 className="text-lg font-bold">加入共享帳本</h3>
                    <button
                      onClick={() => setIsSheetOpen(false)}
                      className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        邀請碼
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          placeholder="請輸入 6 碼或 8 碼邀請碼"
                          className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <button
                          className="shrink-0 whitespace-nowrap rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                          disabled={!inviteCode.trim()}
                        >
                          加入
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700"></div>
                      <span className="mx-4 flex-shrink-0 text-xs text-zinc-400">或使用其他方式</span>
                      <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700"></div>
                    </div>

                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <QrCode className="h-5 w-5" />
                      打開相機掃描 QR Code
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
