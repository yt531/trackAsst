'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Transaction, Category } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { startOfMonth, endOfMonth, format, subMonths, eachDayOfInterval } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)'
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoriesMap, setCategoriesMap] = useState<Record<string, Category>>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentDate]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Categories
      const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      const allCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
      const cMap = allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>);
      setCategoriesMap(cMap);

      // Transactions for current month
      const start = startOfMonth(currentDate).getTime();
      const end = endOfMonth(currentDate).getTime();

      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txs);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(subMonths(currentDate, -1));

  // Process data for charts
  const expenses = transactions.filter(t => t.type === 'expense');

  // Pie Chart Data (Expenses by Category)
  const expensesByCategory = expenses.reduce((acc, tx) => {
    acc[tx.categoryId] = (acc[tx.categoryId] || 0) + tx.baseAmount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory)
    .map(([catId, amount]) => ({
      name: categoriesMap[catId]?.name || '未知',
      value: amount,
    }))
    .sort((a, b) => b.value - a.value);

  // Bar Chart Data (Expenses by Day)
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const dailyData = daysInMonth.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTotal = expenses
      .filter(tx => format(new Date(tx.date), 'yyyy-MM-dd') === dayStr)
      .reduce((sum, tx) => sum + tx.baseAmount, 0);

    return {
      date: format(day, 'd'), // Just the day number
      amount: dayTotal
    };
  });

  const totalExpense = expenses.reduce((sum, tx) => sum + tx.baseAmount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">報表</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            分析與支出趨勢。
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-1 shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 w-fit">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 rounded-lg dark:hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-medium min-w-[120px] text-center">
            {format(currentDate, 'yyyy年MM月')}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()}
            className="p-2 hover:bg-zinc-100 rounded-lg dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-500 dark:text-zinc-400">載入報表中...</div>
      ) : totalExpense === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{format(currentDate, 'yyyy年MM月')} 尚無支出紀錄。</p>
        </div>
      ) : (
        <div className="@container space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">總支出</div>
              <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">NT$ {totalExpense.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">日平均支出</div>
              <div className="text-2xl font-bold mt-1">NT$ {Math.round(totalExpense / daysInMonth.length).toLocaleString()}</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid @md:grid-cols-2 gap-6">

            {/* Pie Chart */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-semibold mb-6">各分類支出</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any) => `NT$ ${Number(value).toLocaleString()}`}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center text-xs">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="truncate flex-1">{entry.name}</span>
                    <span className="font-medium text-zinc-500 dark:text-zinc-400 ml-1">{Math.round((entry.value / totalExpense) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-semibold mb-6">每日支出</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickMargin={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(val) => val === 0 ? '' : (val/1000 >= 1 ? `${val/1000}k` : val)} />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      formatter={(value: any) => [`NT$ ${Number(value).toLocaleString()}`, '支出']}
                      labelFormatter={(label) => `${label}日`}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
