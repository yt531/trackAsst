'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { Transaction, Category, PaymentMethod } from '@/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, endOfYear, addMonths, subMonths, addDays, subDays, addYears, subYears } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { DatePicker } from '@/components/ui/DatePicker';

function PaymentMethodDetail() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paymentMethodId = searchParams.get('id') as string;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [filterMode, setFilterMode] = useState<'year' | 'month' | 'day'>('month');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    if (user && paymentMethodId) {
      loadData();
    }
  }, [user, filterMode, filterDate, paymentMethodId]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load Payment Method
      if (!paymentMethod) {
        const pmDoc = await getDoc(doc(db, 'users', user.uid, 'paymentMethods', paymentMethodId));
        if (pmDoc.exists()) {
          setPaymentMethod({ id: pmDoc.id, ...pmDoc.data() } as PaymentMethod);
        }
      }

      // Load Categories
      if (Object.keys(categories).length === 0) {
        const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
        const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        const allCats = [...DEFAULT_CATEGORIES as Category[], ...customCats];
        const catMap = allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>);
        setCategories(catMap);
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
        where('paymentMethodId', '==', paymentMethodId),
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

  const grouped = transactions.reduce((acc, tx) => {
    const d = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  if (!loading && !paymentMethod) {
    return <div className="p-8 text-center text-sm text-zinc-500">找不到此支付方式</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <Link href="/settings/payment-methods" className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{paymentMethod?.name || '載入中...'}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            檢視此支付方式的專屬紀錄
          </p>
        </div>
      </header>

      {/* Filter and Stats Area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
           {/* Mode Switcher */}
           <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
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
           <div className="flex items-center gap-3">
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
               className="w-48"
             />
             <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="w-5 h-5" /></button>
           </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-500" /> 總收入</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.income.toLocaleString()}</div>
          </div>
          <div>
             <div className="text-xs text-zinc-500 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.expense.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-zinc-500 py-8">載入中...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">此期間找不到交易紀錄。</p>
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
                  const cat = categories[tx.categoryId];
                  const isExpense = tx.type === 'expense';
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isExpense ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {isExpense ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-medium">{cat?.name || '未知分類'}</div>
                          {tx.notes && <div className="text-xs text-zinc-500 mt-0.5">{tx.notes}</div>}
                        </div>
                      </div>
                      <div className={`text-right font-medium ${
                        isExpense ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {isExpense ? '-' : '+'} {tx.amount.toLocaleString()} {tx.currency}
                        {tx.currency !== 'TWD' && (
                           <div className="text-[10px] text-zinc-500">
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
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500">載入中...</div>}>
      <PaymentMethodDetail />
    </Suspense>
  );
}
