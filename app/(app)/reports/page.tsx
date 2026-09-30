'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Transaction, Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { ReportPeriod, getPeriodRange, shiftPeriod } from '@/lib/reports';
import { PageHeader } from '@/components/PageHeader';
import { PeriodNavigator } from '@/components/reports/PeriodNavigator';
import { DailyReport } from '@/components/reports/DailyReport';
import { MonthlyReport } from '@/components/reports/MonthlyReport';
import { YearlyReport } from '@/components/reports/YearlyReport';

const TABS: { value: ReportPeriod; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

const EMPTY_LABEL: Record<ReportPeriod, string> = {
  day: '這一天',
  month: '這個月',
  year: '這一年',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, Category>>({});

  useEffect(() => {
    if (!user) return;
    const loadCategories = async () => {
      try {
        const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
        const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        const allCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
        setCategoriesMap(allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>));
      } catch (e) {
        console.error(e);
      }
    };
    loadCategories();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchRange = async (date: Date) => {
      const { start, end } = getPeriodRange(period, date);
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    };

    const loadTransactions = async () => {
      setLoading(true);
      try {
        const [current, previous] = await Promise.all([
          fetchRange(currentDate),
          fetchRange(shiftPeriod(period, currentDate, -1)),
        ]);
        if (cancelled) return;
        setTransactions(current);
        setPreviousTransactions(previous);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTransactions();

    return () => { cancelled = true; };
  }, [user, period, currentDate]);

  const hasRecords = transactions.some(t => t.type === 'expense' || t.type === 'income');

  return (
    <div className="space-y-6">
      <PageHeader title="報表" backHref="/more" />
      <header className="hidden md:block">
        <h1 className="text-2xl font-bold tracking-tight">報表</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          分析與收支趨勢。
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        <div className="flex w-fit rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setPeriod(tab.value)}
              className={`rounded-lg px-5 py-1.5 text-sm font-medium ${period === tab.value ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <PeriodNavigator period={period} date={currentDate} onChange={setCurrentDate} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-500 dark:text-zinc-400">載入報表中...</div>
      ) : !hasRecords ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{EMPTY_LABEL[period]}尚無紀錄。</p>
        </div>
      ) : period === 'day' ? (
        <DailyReport transactions={transactions} previousTransactions={previousTransactions} categoriesMap={categoriesMap} />
      ) : period === 'month' ? (
        <MonthlyReport date={currentDate} transactions={transactions} previousTransactions={previousTransactions} categoriesMap={categoriesMap} />
      ) : (
        <YearlyReport transactions={transactions} previousTransactions={previousTransactions} categoriesMap={categoriesMap} />
      )}
    </div>
  );
}
