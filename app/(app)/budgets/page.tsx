'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getBudgetsByMonth, saveBudget } from '@/lib/budget';
import type { Budget, Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, getUserCollection } from '@/lib/db';
import { format } from 'date-fns';
import { Plus, Wallet, Trash2 } from 'lucide-react';

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'daily' | 'monthly'>('monthly');
  const [categoryId, setCategoryId] = useState<string>(''); // empty means 'total'

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch budgets
        const fetchedBudgets = await getBudgetsByMonth(user.uid, selectedMonth);
        setBudgets(fetchedBudgets);

        // Fetch custom categories
        const catRef = getUserCollection(user.uid, COLLECTIONS.CATEGORIES);
        const catSnap = await getDocs(catRef);
        const customCats = catSnap.docs.map(doc => doc.data() as Category);
        setCategories([...DEFAULT_CATEGORIES as Category[], ...customCats]);
      } catch (error) {
        console.error('Error fetching budgets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedMonth]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    try {
      const newBudget = await saveBudget(user.uid, {
        userId: user.uid,
        amount: Number(amount),
        period,
        month: selectedMonth,
        categoryId: categoryId || undefined,
      });

      setBudgets(prev => {
        // Remove existing if same category
        const filtered = prev.filter(b => b.categoryId !== newBudget.categoryId);
        return [...filtered, newBudget];
      });

      setIsFormOpen(false);
      setAmount('');
      setCategoryId('');
      setPeriod('monthly');
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('儲存失敗');
    }
  };

  const getCategoryName = (id?: string) => {
    if (!id) return '總預算';
    return categories.find(c => c.id === id)?.name || '未知分類';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">預算管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">設定並追蹤您的花費目標</p>
        </div>
        <input 
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      <div className="flex justify-end">
         <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新增/修改預算
          </button>
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold">設定預算</h2>
          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">預算類型</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">總預算</option>
                  <optgroup label="分類預算">
                    {categories.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">預算週期</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as 'daily' | 'monthly')}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="monthly">每月</option>
                  <option value="daily">每日</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">金額</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="輸入預算金額"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                儲存
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-500">載入中...</div>
      ) : budgets.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <Wallet className="mb-2 h-8 w-8 text-zinc-400" />
          <p className="text-sm text-zinc-500">此月份尚無設定預算</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map(budget => (
            <div key={budget.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${!budget.categoryId ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {getCategoryName(budget.categoryId)}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {budget.period === 'monthly' ? '每月預算' : '每日預算'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                ${budget.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
