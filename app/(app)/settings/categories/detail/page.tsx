'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, setDoc, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { Transaction, Category } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, endOfYear, addMonths, subMonths, addDays, subDays, addYears, subYears } from 'date-fns';
import { DatePicker } from '@/components/ui/DatePicker';
import { PageHeader } from '@/components/PageHeader';

function CategoryDetail() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryId = searchParams.get('id') as string;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterMode, setFilterMode] = useState<'year' | 'month' | 'day'>('month');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    if (user && categoryId) {
      loadData();
    }
  }, [user, filterMode, filterDate, categoryId]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let currentAllCats = allCategories;
      // Load Categories
      if (currentAllCats.length === 0) {
        const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
        const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        currentAllCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
        setAllCategories(currentAllCats);
      }

      // Load specific category
      if (!category) {
        const found = currentAllCats.find((c: Category) => c.id === categoryId);
        if (found) {
          setCategory(found);
          setName(found.name);
          setType(found.type as 'income' | 'expense');
        }
      }

      // Load Transactions based on filter
      let start = 0;
      let end = 0;
      
      if (filterMode === 'year') {
        start = startOfYear(filterDate).getTime();
        end = endOfYear(filterDate).getTime();
      } else if (filterMode === 'month') {
        start = startOfMonth(filterDate).getTime();
        end = endOfMonth(filterDate).getTime();
      } else {
        start = startOfDay(filterDate).getTime();
        end = endOfDay(filterDate).getTime();
      }

      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        where('categoryId', '==', categoryId),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      
      let inc = 0;
      let exp = 0;
      txs.forEach(t => {
        if (t.type === 'income') inc += t.baseAmount;
        if (t.type === 'expense') exp += t.baseAmount;
      });

      setTotals({ income: inc, expense: exp });
      setTransactions(txs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setFilterDate(prev => {
      if (filterMode === 'year') return subYears(prev, 1);
      if (filterMode === 'month') return subMonths(prev, 1);
      return subDays(prev, 1);
    });
  };

  const handleNext = () => {
    setFilterDate(prev => {
      if (filterMode === 'year') return addYears(prev, 1);
      if (filterMode === 'month') return addMonths(prev, 1);
      return addDays(prev, 1);
    });
  };

  const handleEdit = () => {
    if (!category) return;
    setType(category.type as 'income' | 'expense');
    setName(category.name);
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!user || !category || !confirm('確定要刪除此分類嗎？相關的交易紀錄不會被刪除，但可能會無法顯示正確分類名稱。')) return;
    try {
      if (category.isCustom) {
        await deleteDoc(doc(db, 'users', user.uid, 'categories', category.id));
      } else {
        await setDoc(doc(db, 'users', user.uid, 'categories', category.id), { isDeleted: true }, { merge: true });
      }
      
      router.push('/settings/categories');
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !user || !category) return;
    setIsSaving(true);
    try {
      const updatedCat = { ...category, name, type };
      const { id, ...dataToSave } = updatedCat as any;
      await setDoc(doc(db, 'users', user.uid, 'categories', category.id), dataToSave, { merge: true });
      
      setCategory(updatedCat);
      setIsEditing(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const grouped = transactions.reduce((acc, tx) => {
    const d = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  if (!loading && !category) {
    return <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">找不到此分類</div>;
  }

  const actionButtons = category && !isEditing ? (
    <div className="flex items-center gap-2">
      <button onClick={handleEdit} className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 bg-white hover:bg-blue-50 dark:hover:text-blue-400 dark:bg-zinc-800 dark:hover:bg-blue-900/30 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm" title="修改">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={handleDelete} className="p-2 text-zinc-500 hover:text-red-600 dark:text-zinc-400 bg-white hover:bg-red-50 dark:hover:text-red-400 dark:bg-zinc-800 dark:hover:bg-red-900/30 rounded-full border border-zinc-200 dark:border-zinc-700 transition-colors shadow-sm" title="刪除">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title={category?.name || '載入中...'} backHref="/settings/categories" rightAction={actionButtons} />
      <header className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/settings/categories" className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{category?.name || '載入中...'}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              檢視此分類的專屬紀錄
            </p>
          </div>
        </div>
        {actionButtons}
      </header>

      {isEditing && (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label className="mb-1 block text-sm font-medium">類型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                  type === 'expense'
                    ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-400'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowDownRight className="h-4 w-4" />
                支出
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                  type === 'income'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                收入
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">分類名稱 *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：訂閱服務"
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50">
              {isSaving ? '儲存中...' : '儲存'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* Filter and Stats Area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
         <div className="flex flex-col items-center justify-center gap-4 mb-4">
           {/* Mode Switcher */}
           <div className="flex w-full sm:w-80 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
             <button
               onClick={() => setFilterMode('year')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'year' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}`}
             >
               按年
             </button>
             <button
               onClick={() => setFilterMode('month')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'month' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}`}
             >
               按月
             </button>
             <button
               onClick={() => setFilterMode('day')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'day' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'}`}
             >
               按日
             </button>
           </div>
           
           {/* Date Selector */}
           <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
             <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="w-5 h-5" /></button>
             <DatePicker
               type={filterMode === 'year' ? 'year' : filterMode === 'month' ? 'month' : 'date'}
               value={filterMode === 'year' ? format(filterDate, 'yyyy') : filterMode === 'month' ? format(filterDate, 'yyyy-MM') : format(filterDate, 'yyyy-MM-dd')}
               onChange={(val) => {
                 if (val) {
                   if (filterMode === 'year') {
                     setFilterDate(new Date(`${val}-01-01`));
                   } else {
                     setFilterDate(new Date(val));
                   }
                 } else {
                   setFilterDate(new Date());
                 }
               }}
               className="w-32 sm:w-48"
               showTodayButton={false}
             />
             <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="w-5 h-5" /></button>
             <button
               onClick={() => setFilterDate(new Date())}
               className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-[10px] text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
             >
               {filterMode === 'year' ? '今年' : filterMode === 'month' ? '本月' : '今天'}
             </button>
           </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-500" /> 總收入</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.income.toLocaleString()}</div>
          </div>
          <div>
             <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.expense.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">載入中...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">此期間找不到交易紀錄。</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, txs]) => (
            <div key={dateStr}>
              <h3 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {format(new Date(dateStr), 'yyyy年MM月dd日')}
              </h3>
              <div className="space-y-2">
                {txs.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isExpense ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {isExpense ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-medium">{category?.name || '未知分類'}</div>
                          {tx.details && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{tx.details}</div>}
                          {tx.notes && <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 italic">{tx.notes}</div>}
                        </div>
                      </div>
                      <div className={`text-right font-medium ${
                        isExpense ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {isExpense ? '-' : '+'} {tx.amount.toLocaleString()} {tx.currency}
                        {tx.currency !== 'TWD' && (
                           <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                             (≈ {tx.baseAmount.toLocaleString()} TWD)
                           </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageClient() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>}>
      <CategoryDetail />
    </Suspense>
  );
}
