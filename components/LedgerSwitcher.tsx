'use client';

import { useLedger } from './LedgerProvider';
import { Users, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function LedgerSwitcher() {
  const { activeLedgerId, ledgers, setActiveLedgerId, isLoading } = useLedger();
  const router = useRouter();

  if (isLoading) {
    return <div className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/50"></div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'NEW_LEDGER') {
      router.push('/settings/ledgers');
      return;
    }
    setActiveLedgerId(value === 'PERSONAL' ? null : value);
  };

  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        {activeLedgerId ? <Users className="h-4 w-4 text-blue-500" /> : <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />}
      </div>
      <select
        value={activeLedgerId || 'PERSONAL'}
        onChange={handleChange}
        className="w-full appearance-none rounded-lg border border-transparent bg-zinc-50 py-2.5 pl-10 pr-8 text-sm font-medium text-zinc-900 hover:bg-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
      >
        <option value="PERSONAL">個人帳本</option>
        {ledgers.length > 0 && <optgroup label="共享帳本" />}
        {ledgers.map(ledger => (
          <option key={ledger.id} value={ledger.id}>
            {ledger.name}
          </option>
        ))}
        <optgroup label="管理" />
        <option value="NEW_LEDGER">⚙️ 管理 / 新增共享帳本</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
