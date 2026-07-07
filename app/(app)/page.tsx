'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { Transaction } from '@/types';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Wallet, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { getBudgetsByMonth } from '@/lib/budget';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBalance: 0,
    monthlyExpense: 0,
    monthlyIncome: 0,
    budget: 0
  });
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now).getTime();
      const monthEnd = endOfMonth(now).getTime();
      const monthStr = format(now, 'yyyy-MM');

      // Load monthly transactions for stats
      const qMonthly = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd)
      );
      const monthlySnap = await getDocs(qMonthly);

      let expense = 0;
      let income = 0;

      monthlySnap.docs.forEach(doc => {
        const data = doc.data() as Transaction;
        if (data.type === 'expense') expense += data.baseAmount;
        if (data.type === 'income') income += data.baseAmount;
      });

      // Load Budget
      const budgets = await getBudgetsByMonth(user.uid, monthStr);
      const totalBudget = budgets.find(b => !b.categoryId);
      const budgetAmount = totalBudget ? totalBudget.amount : 0;

      // Load 5 most recent transactions
      const qRecent = query(
        collection(db, 'users', user.uid, 'transactions'),
        orderBy('date', 'desc'),
        limit(5)
      );
      const recentSnap = await getDocs(qRecent);
      const recent = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));

      setStats({
        totalBalance: income - expense, // Simplified
        monthlyExpense: expense,
        monthlyIncome: income,
        budget: budgetAmount
      });
      setRecentTxs(recent);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">儀表板</h1>
        <div className="flex gap-2">
           <Link
             href="/invoices/scan"
             className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
           >
             <Wallet className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
           </Link>
           <Link
             href="/transactions/new"
             className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
           >
             <Plus className="h-5 w-5" />
           </Link>
        </div>
      </header>

      {/* Hero Card */}
      <div className="rounded-3xl bg-zinc-900 p-6 text-white shadow-xl dark:bg-zinc-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Wallet className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <p className="text-sm font-medium text-zinc-400">當月總預算餘額</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight">
            {loading ? '...' : `NT$ ${(stats.budget - stats.monthlyExpense).toLocaleString()}`}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">總預算: ${stats.budget.toLocaleString()}</p>

          <div className="mt-8 flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                收入
              </div>
              <p className="mt-1 text-lg font-semibold">{loading ? '...' : stats.monthlyIncome.toLocaleString()}</p>
            </div>
            <div className="h-8 w-[1px] bg-zinc-700"></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                  <ArrowDownRight className="h-4 w-4" />
                </div>
                支出
              </div>
              <p className="mt-1 text-lg font-semibold">{loading ? '...' : stats.monthlyExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions or Budgets can go here */}

      {/* Recent Transactions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">近期交易</h3>
          <Link href="/transactions" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            查看全部
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-zinc-500">載入中...</div>
        ) : recentTxs.length === 0 ? (
           <div className="text-center py-8 text-sm text-zinc-500 bg-white rounded-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
             近期無交易紀錄。
           </div>
        ) : (
          <div className="space-y-3">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    tx.type === 'expense' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                  }`}>
                    {tx.type === 'expense' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{DEFAULT_CATEGORIES.find(c => c.id === tx.categoryId)?.name || '自訂分類'}</div>
                    <div className="text-xs text-zinc-500">{format(new Date(tx.date), 'MMM d')}</div>
                  </div>
                </div>
                <div className={`font-medium ${
                  tx.type === 'expense' ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'
                }`}>
                  {tx.type === 'expense' ? '-' : '+'}{tx.amount.toLocaleString()} {tx.currency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
