'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { LedgerPrivacyText } from '@/components/LedgerPrivacyProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { Transaction, Category, LedgerMember } from '@/types';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { DatePicker } from '@/components/ui/DatePicker';
import { useSearchParams } from 'next/navigation';
import { startOfYear, endOfYear, addYears, subYears } from 'date-fns';
import { getLedgerMembers } from '@/lib/ledger';
import { deleteTransaction } from '@/lib/transactions';

function LedgerTransactionsList() {
  const { user } = useAuth();
  const { activeLedgerId, activeLedger } = useLedger();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [members, setMembers] = useState<Record<string, LedgerMember>>({});
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const initialFilterMode = (searchParams.get('filterMode') as 'month' | 'day' | 'year') || 'month';
  const initialDateStr = searchParams.get('date');
  const initialCategoryId = searchParams.get('categoryId') || null;

  const [filterMode, setFilterMode] = useState<'month' | 'day' | 'year'>(initialFilterMode);
  const [filterDate, setFilterDate] = useState<Date>(initialDateStr ? new Date(initialDateStr) : new Date());
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(initialCategoryId);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    if (user && activeLedgerId) {
      loadData();
    }
  }, [user, activeLedgerId, filterMode, filterDate, filterCategoryId]);

  const loadData = async () => {
    if (!user || !activeLedgerId) return;
    setLoading(true);
    try {
      // Load Members
      if (Object.keys(members).length === 0) {
        const ledgerMembers = await getLedgerMembers(activeLedgerId);
        const membersMap = ledgerMembers.reduce((acc, m) => {
          acc[m.userId] = m;
          return acc;
        }, {} as Record<string, LedgerMember>);
        setMembers(membersMap);
      }

      // Load Categories (using default for now as shared ledger custom categories might not be fully built)
      if (Object.keys(categories).length === 0) {
        const catsSnap = await getDocs(collection(db, 'ledgers', activeLedgerId, 'categories'));
        let allCats = DEFAULT_CATEGORIES as Category[];
        if (!catsSnap.empty) {
          const customCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
          allCats = [...allCats, ...customCats]; 
        }
        const catMap = allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>);
        setCategories(catMap);
      }

      // Load Transactions based on filter
      const start = filterMode === 'year' ? startOfYear(filterDate).getTime() : filterMode === 'month' ? startOfMonth(filterDate).getTime() : startOfDay(filterDate).getTime();
      const end = filterMode === 'year' ? endOfYear(filterDate).getTime() : filterMode === 'month' ? endOfMonth(filterDate).getTime() : endOfDay(filterDate).getTime();

      let q = query(
        collection(db, 'ledgers', activeLedgerId, 'transactions'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );

      if (filterCategoryId) {
        q = query(q, where('categoryId', '==', filterCategoryId));
      }

      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      let inc = 0;
      let exp = 0;
      txs.forEach(t => {
        if (t.type === 'income') inc += t.baseAmount || t.amount;
        if (t.type === 'expense') exp += t.baseAmount || t.amount;
      });

      setTotals({ income: inc, expense: exp });
      setTransactions(txs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tx: Transaction) => {
    if (!user || !activeLedgerId || !confirm('確定要刪除這筆共享交易嗎？')) return;
    try {
      await deleteTransaction(user.uid, tx.id, true, activeLedgerId, tx);
      setTotals(prev => ({
        income: prev.income - (tx.type === 'income' ? (tx.baseAmount || tx.amount) : 0),
        expense: prev.expense - (tx.type === 'expense' ? (tx.baseAmount || tx.amount) : 0),
      }));
      setTransactions(transactions.filter(t => t.id !== tx.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrev = () => {
    setFilterDate(prev => filterMode === 'year' ? subYears(prev, 1) : filterMode === 'month' ? subMonths(prev, 1) : subDays(prev, 1));
  };

  const handleNext = () => {
    setFilterDate(prev => filterMode === 'year' ? addYears(prev, 1) : filterMode === 'month' ? addMonths(prev, 1) : addDays(prev, 1));
  };

  const grouped = transactions.reduce((acc, tx) => {
    const d = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const getMemberDisplayName = (uid: string) => {
    if (uid === user?.uid) return '我';
    return members[uid]?.nickname || uid.substring(0, 4);
  };

  return (
    <div className="space-y-6">
      {/* Filter and Stats Area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
        <div className="flex flex-col items-center justify-center gap-4 mb-4">
          {/* Mode Switcher */}
          <div className="flex w-full sm:w-64 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              onClick={() => setFilterMode('year')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'year' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'}`}
            >
              按年
            </button>
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

          {filterCategoryId && (
            <div className="w-full flex justify-center">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                篩選分類：{categories[filterCategoryId]?.name || '未知'}
                <button 
                  onClick={() => setFilterCategoryId(null)}
                  className="hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5 rounded-full transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )}

          {/* Date Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
            <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="w-5 h-5" /></button>
            <DatePicker
              type={filterMode === 'year' ? 'year' : filterMode === 'month' ? 'month' : 'date'}
              value={filterMode === 'year' ? format(filterDate, 'yyyy') : filterMode === 'month' ? format(filterDate, 'yyyy-MM') : format(filterDate, 'yyyy-MM-dd')}
              onChange={(val) => setFilterDate(val ? new Date(val) : new Date())}
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
            <div className="text-lg font-semibold mt-1"><LedgerPrivacyText type="summary" text={`NT$ ${totals.income.toLocaleString()}`} /></div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1"><LedgerPrivacyText type="summary" text={`NT$ ${totals.expense.toLocaleString()}`} /></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">載入中...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">此期間找不到交易紀錄。</p>
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
                  
                  // Shared ledger logic
                  let payerId = tx.userId; // Default payer
                  let myOwed = 0;
                  
                  if (activeLedger?.mode === 'split' && tx.splits) {
                    const payerSplit = tx.splits.find(s => s.paidAmount > 0);
                    if (payerSplit) {
                      payerId = payerSplit.userId;
                    }
                    const mySplit = tx.splits.find(s => s.userId === user?.uid);
                    if (mySplit) {
                      myOwed = mySplit.owedAmount;
                    }
                  }

                  const payerName = getMemberDisplayName(payerId);

                  const isCreator = tx.userId === user?.uid;
                  const currentUserRole = members[user?.uid || '']?.role || 'viewer';
                  const isAdmin = currentUserRole === 'admin';
                  const canEdit = isCreator || isAdmin;

                  return (
                    <div key={tx.id} className="flex items-center gap-3 sm:gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors group">
                      <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${isExpense ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                        {isExpense ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={cat?.name || '未知分類'}>{cat?.name || '未知分類'}</div>
                        <div className="text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{payerName}</span> 代墊
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={`text-right font-medium whitespace-nowrap ${isExpense ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'}`}>
                          <LedgerPrivacyText text={`${isExpense ? '-' : '+'} ${tx.amount.toLocaleString()} ${tx.currency}`} />
                        </div>
                        {activeLedger?.mode === 'split' && myOwed > 0 && (
                          <div className="text-[11px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-400">
                            您需分攤: <LedgerPrivacyText text={`${myOwed.toLocaleString()} ${tx.currency}`} />
                          </div>
                        )}
                        {canEdit && (
                          <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Link href={`/ledgers/detail/transactions/edit?id=${activeLedgerId}&txId=${tx.id}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300">
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(tx)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

export default function LedgerTransactionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>}>
      <LedgerTransactionsList />
    </Suspense>
  );
}
