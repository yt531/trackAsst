'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { Invoice } from '@/types';
import Link from 'next/link';
import { ScanLine, Receipt, Settings2, Cloud, FileText, ChevronLeft, ChevronRight, Calendar, ArrowDownRight, Hash } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { DatePicker } from '@/components/ui/DatePicker';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cloud' | 'paper'>('cloud');
  
  const [filterMode, setFilterMode] = useState<'month' | 'day'>('month');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [totals, setTotals] = useState({ expense: 0, count: 0 });

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user, filterMode, filterDate, activeTab]);

  const loadInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = filterMode === 'month' ? startOfMonth(filterDate).getTime() : startOfDay(filterDate).getTime();
      const end = filterMode === 'month' ? endOfMonth(filterDate).getTime() : endOfDay(filterDate).getTime();

      const q = query(
        collection(db, 'users', user.uid, 'invoices'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      
      const filteredData = data.filter(inv => inv.type === activeTab);
      
      let exp = 0;
      filteredData.forEach(inv => {
        exp += inv.totalAmount;
      });

      setTotals({ expense: exp, count: filteredData.length });
      setInvoices(filteredData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setFilterDate(prev => filterMode === 'month' ? subMonths(prev, 1) : subDays(prev, 1));
  };

  const handleNext = () => {
    setFilterDate(prev => filterMode === 'month' ? addMonths(prev, 1) : addDays(prev, 1));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">發票存摺</h1>
        </div>
        <Link
          href="/invoices/scan"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">掃描發票</span>
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          onClick={() => setActiveTab('cloud')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'cloud'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Cloud className="h-4 w-4" />
          雲端發票
        </button>
        <button
          onClick={() => setActiveTab('paper')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'paper'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          紙本掃描
        </button>
      </div>

      {/* Filter and Stats Area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
        <div className="flex flex-col items-center justify-center gap-4 mb-4">
           {/* Mode Switcher */}
           <div className="flex w-full sm:w-64 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
             <button
               onClick={() => setFilterMode('month')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'month' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'}`}
             >
               按月
             </button>
             <button
               onClick={() => setFilterMode('day')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'day' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'}`}
             >
               按日
             </button>
           </div>
           
           {/* Date Selector */}
           <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
             <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="w-5 h-5" /></button>
             <DatePicker
               type={filterMode === 'month' ? 'month' : 'date'}
               value={filterMode === 'month' ? format(filterDate, 'yyyy-MM') : format(filterDate, 'yyyy-MM-dd')}
               onChange={(val) => setFilterDate(val ? new Date(val) : new Date())}
               className="w-32 sm:w-48"
               showTodayButton={false}
             />
             <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="w-5 h-5" /></button>
             <button
               onClick={() => setFilterDate(new Date())}
               className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-[10px] text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
             >
               {filterMode === 'month' ? '本月' : '今天'}
             </button>
           </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.expense.toLocaleString()}</div>
          </div>
          <div>
             <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Hash className="w-3 h-3 text-blue-500" /> 發票張數</div>
            <div className="text-lg font-semibold mt-1">{totals.count} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">張</span></div>
          </div>
        </div>
      </div>

      {activeTab === 'cloud' && (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <Cloud className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-lg font-medium">敬請期待</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            未來將整合財政部電子發票 API 載入雲端發票。
          </p>
        </div>
      )}

      {activeTab === 'paper' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">載入中...</div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
              <Receipt className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <h3 className="text-lg font-medium">此期間尚無發票紀錄</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                掃描您的紙本電子發票以在此處追蹤它們。
              </p>
              <Link
                href="/invoices/scan"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                立即掃描發票 &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{format(new Date(inv.date), 'yyyy/MM/dd')}</div>
                      <div className="font-mono text-sm font-medium mt-1">{inv.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-600 dark:text-blue-400">NT$ {inv.totalAmount}</div>
                      {inv.isLinkedToTransaction ? (
                        <span className="text-[10px] uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">已記帳</span>
                      ) : (
                        <Link href={`/transactions/new?invoiceId=${inv.id}`} className="text-[10px] uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full">前往記帳</Link>
                      )}
                    </div>
                  </div>
                  {inv.items && inv.items.length > 0 && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {inv.items.map(i => i.description).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
