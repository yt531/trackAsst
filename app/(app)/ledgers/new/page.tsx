'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { ArrowLeft, Plus } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useRouter } from 'next/navigation';
import { createLedger, addLedgerMember } from '@/lib/ledger';
import { Ledger, LedgerMode, LedgerMember } from '@/types';
import { PageHeader } from '@/components/PageHeader';

export default function NewLedgerPage() {
  const { user } = useAuth();
  const { refreshLedgers, setActiveLedgerId } = useLedger();
  const router = useRouter();

  const [name, setName] = useState('');
  const [mode, setMode] = useState<LedgerMode>('shared_fund');
  const [currency, setCurrency] = useState('TWD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const newLedgerId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const newLedger: Ledger = {
        id: newLedgerId,
        name: name.trim(),
        type: 'shared',
        mode,
        currency,
        createdAt: Date.now(),
        createdBy: user.uid,
        settings: {
          allowMembersToCreateCategories: false,
          allowMembersToCreateTags: false,
        }
      };

      const newMember: LedgerMember = {
        id: `${newLedgerId}_${user.uid}`,
        ledgerId: newLedgerId,
        userId: user.uid,
        role: 'admin',
        joinedAt: Date.now(),
        status: 'active',
        notificationPreferences: {
          all: true,
          newTransaction: true,
          updateTransaction: true,
          settlement: true
        }
      };

      await createLedger(newLedger);
      await addLedgerMember(newMember);
      
      await refreshLedgers();
      setActiveLedgerId(newLedgerId);
      router.push(`/ledgers/detail?id=${newLedgerId}`);
    } catch (error) {
      console.error('Error creating ledger:', error);
      alert('建立帳本時發生錯誤');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="建立新共享帳本" backHref="/ledgers" />
      <header className="hidden md:flex items-center gap-4 mb-6">
        <Link href="/ledgers" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">建立新共享帳本</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            建立一個帳本並邀請其他人一起記帳
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">帳本名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：日本旅遊基金、家庭公積金"
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">記帳模式</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as LedgerMode)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="shared_fund">公積金模式 (多人共同記帳，無代墊欠款)</option>
              <option value="split">分帳模式 (支援代墊與分攤，自動計算欠款)</option>
            </select>
            <p className="mt-1.5 text-xs text-zinc-500">
              {mode === 'shared_fund' 
                ? '所有支出由共同資金支付，不計算個人代墊。' 
                : '適合各種代墊、平分、按比例分攤的複雜情境。'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">主幣別</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="TWD">新台幣 (TWD)</option>
              <option value="JPY">日圓 (JPY)</option>
              <option value="USD">美元 (USD)</option>
            </select>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              '建立中...'
            ) : (
              <>
                <Plus className="h-5 w-5" />
                建立帳本
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
