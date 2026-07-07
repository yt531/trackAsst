'use client';

import { useAuth } from '@/components/AuthProvider';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Welcome back, {user?.displayName || 'User'}
          </p>
        </div>
      </header>
      
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Balance</h3>
          <div className="mt-2 text-3xl font-bold">$0.00</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Monthly Expenses</h3>
          <div className="mt-2 text-3xl font-bold">$0.00</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Remaining Budget</h3>
          <div className="mt-2 text-3xl font-bold">$0.00</div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
            No transactions yet. Start tracking!
          </div>
        </div>
      </div>
    </div>
  );
}
