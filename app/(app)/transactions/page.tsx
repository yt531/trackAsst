'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { usePrivacy, PrivacyContext } from '@/components/PrivacyProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { Transaction, Category, PaymentMethod } from '@/types';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Calendar, Pencil } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { DatePicker } from '@/components/ui/DatePicker';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

const transactionPrivacyOptions = [
  { value: 0, emoji: '👀', label: '顯示全部金額', description: '顯示交易明細與總收支等金額' },
  { value: 1, emoji: '🫣', label: '隱藏交易明細金額', description: '只隱藏交易明細金額' },
  { value: 2, emoji: '😎', label: '隱藏總收支金額', description: '只隱藏總收支金額' },
  { value: 3, emoji: '🙈', label: '隱藏全部金額', description: '隱藏交易明細與總收支等金額' },
];

function TransactionPrivacyDropdown({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const { privacyLevel, setPrivacyLevel } = usePrivacy();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentOption = transactionPrivacyOptions.find((opt) => opt.value === privacyLevel) || transactionPrivacyOptions[0];

  return (
    <div className={`relative ${variant === 'full' ? 'w-full' : ''}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          variant === 'icon'
            ? 'flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none'
            : 'w-full flex items-center justify-between bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-lg px-4 py-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 focus:outline-none transition-colors'
        }
        title="切換防窺模式"
      >
        {variant === 'icon' ? (
          <span className="text-xl leading-none">{currentOption.emoji}</span>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-lg leading-none">{currentOption.emoji}</span>
              <span>{currentOption.label}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur-md shadow-xl dark:border-zinc-700 dark:bg-zinc-800/95 overflow-hidden ${variant === 'icon' ? 'right-0 top-full origin-top-right' : 'bottom-full mb-2 left-0 origin-bottom-left'
            }`}
        >
          <div className="p-2 space-y-1">
            <div className="px-2 py-1.5 mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              防窺程度
            </div>
            {transactionPrivacyOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPrivacyLevel(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all duration-200 ${privacyLevel === option.value
                  ? 'bg-blue-50/80 dark:bg-blue-900/30'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                  }`}
              >
                <span className="text-xl mt-0.5">{option.emoji}</span>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${privacyLevel === option.value ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {option.label}
                  </span>
                  <span className={`text-xs mt-0.5 ${privacyLevel === option.value ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {option.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionPrivacyText({ type = 'item', text, className = '' }: { type?: 'summary' | 'item'; text: string | number; className?: string }) {
  const { privacyLevel } = usePrivacy();

  let shouldBlur = false;
  if (privacyLevel === 3) shouldBlur = true;
  else if (privacyLevel === 1 && type === 'item') shouldBlur = true;
  else if (privacyLevel === 2 && type === 'summary') shouldBlur = true;

  if (shouldBlur) {
    return <span className={`filter blur-sm select-none opacity-80 ${className}`}>****</span>;
  }

  return <span className={className}>{text}</span>;
}

function TransactionsList() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [loading, setLoading] = useState(true);

  const initialFilterMode = (searchParams.get('filterMode') as 'month' | 'day') || 'month';
  const initialDateStr = searchParams.get('date');
  const initialCategoryId = searchParams.get('categoryId') || null;

  const [filterMode, setFilterMode] = useState<'month' | 'day'>(initialFilterMode);
  const [filterDate, setFilterDate] = useState<Date>(initialDateStr ? new Date(initialDateStr) : new Date());
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(initialCategoryId);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filterMode, filterDate, filterCategoryId]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load Categories
      if (Object.keys(categories).length === 0) {
        const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
        const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
        const allCats = mergeCategories(DEFAULT_CATEGORIES as Category[], customCats);
        const catMap = allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>);
        setCategories(catMap);
      }

      // Load Payment Methods
      if (Object.keys(paymentMethods).length === 0) {
        const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
        const pmMap = pmSnapshot.docs.reduce((acc, d) => {
          acc[d.id] = { id: d.id, ...d.data() } as PaymentMethod;
          return acc;
        }, {} as Record<string, PaymentMethod>);
        setPaymentMethods(pmMap);
      }

      // Load Transactions based on filter
      const start = filterMode === 'month' ? startOfMonth(filterDate).getTime() : startOfDay(filterDate).getTime();
      const end = filterMode === 'month' ? endOfMonth(filterDate).getTime() : endOfDay(filterDate).getTime();

      let q = query(
        collection(db, 'users', user.uid, 'transactions'),
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

  const handleDelete = async (id: string) => {
    if (!user || !confirm('確定要刪除這筆交易紀錄嗎？')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
      const deletedTx = transactions.find(t => t.id === id);
      if (deletedTx) {
        setTotals(prev => ({
          income: prev.income - (deletedTx.type === 'income' ? deletedTx.baseAmount : 0),
          expense: prev.expense - (deletedTx.type === 'expense' ? deletedTx.baseAmount : 0),
        }));
      }
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrev = () => {
    setFilterDate(prev => filterMode === 'month' ? subMonths(prev, 1) : subDays(prev, 1));
  };

  const handleNext = () => {
    setFilterDate(prev => filterMode === 'month' ? addMonths(prev, 1) : addDays(prev, 1));
  };

  const grouped = transactions.reduce((acc, tx) => {
    const d = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="交易紀錄"
        backHref="/"
        rightAction={
          <div className="flex items-center gap-1 sm:gap-2">
            <TransactionPrivacyDropdown variant="icon" />
            <Link href="/transactions/new" className="p-2 text-blue-600 dark:text-blue-400">
              <Plus className="h-5 w-5" />
            </Link>
          </div>
        }
      />
      <header className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">交易紀錄</h1>
          {filterCategoryId && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              篩選分類: {categories[filterCategoryId]?.name || '未知分類'}
              <button onClick={() => setFilterCategoryId(null)} className="ml-2 underline text-xs">清除篩選</button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <TransactionPrivacyDropdown variant="icon" />
          <Link
            href="/transactions/new"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新增</span>
          </Link>
        </div>
      </header>

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
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-500" /> 總收入</div>
            <div className="text-lg font-semibold mt-1"><TransactionPrivacyText type="summary" text={`NT$ ${totals.income.toLocaleString()}`} /></div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1"><TransactionPrivacyText type="summary" text={`NT$ ${totals.expense.toLocaleString()}`} /></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">載入中...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">此期間找不到交易紀錄。</p>
          <Link href="/transactions/new" className="text-blue-600 hover:underline">新增一筆交易</Link>
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
                  const pm = paymentMethods[tx.paymentMethodId];
                  const isExpense = tx.type === 'expense';
                  return (
                    <div key={tx.id} className="flex items-center gap-3 sm:gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors group">
                      <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${isExpense ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                        {isExpense ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={cat?.name || '未知分類'}>{cat?.name || '未知分類'}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                          <span className="truncate" title={tx.paymentMethodId === 'cash' ? '現金' : tx.paymentMethodId === 'unset' ? '未設定支付方式' : (pm?.name || '未知支付方式')}>
                            {tx.paymentMethodId === 'cash'
                              ? '現金'
                              : tx.paymentMethodId === 'unset'
                                ? '未設定支付方式'
                                : (pm?.name || '未知支付方式')}
                          </span>
                          {tx.invoiceId && <span className="shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-[10px]">發票</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                        <div className={`text-right font-medium whitespace-nowrap ${isExpense ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'
                          }`}>
                          <TransactionPrivacyText text={`${isExpense ? '-' : '+'} ${tx.amount.toLocaleString()} ${tx.currency}`} />
                          {tx.currency !== 'TWD' && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              <TransactionPrivacyText text={`(≈ ${tx.baseAmount.toLocaleString()} TWD)`} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Link
                            href={`/transactions/new?editId=${tx.id}`}
                            className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 bg-zinc-100 hover:bg-blue-50 dark:text-zinc-400 dark:hover:text-blue-400 dark:bg-zinc-800 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                            title="修改"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-2 text-zinc-500 hover:text-red-600 dark:text-zinc-400 bg-zinc-100 hover:bg-red-50 dark:text-zinc-400 dark:hover:text-red-400 dark:bg-zinc-800 dark:hover:bg-red-900/30 rounded-full transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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

function LocalPrivacyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [localLevel, setLocalLevel] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('transactionsPrivacyLevel');
    if (saved !== null) {
      setLocalLevel(parseInt(saved, 10));
    } else {
      const defaultSaved = localStorage.getItem('cachedDefaultPrivacyLevel');
      if (defaultSaved !== null) {
        setLocalLevel(parseInt(defaultSaved, 10));
      }
    }

    if (user) {
      import('@/lib/db').then(({ getUserSettings }) => {
        getUserSettings(user.uid).then(settings => {
          const level = settings?.transactionsPrivacyLevel ?? settings?.defaultPrivacyLevel ?? 0;
          setLocalLevel(level);
          localStorage.setItem('transactionsPrivacyLevel', level.toString());
        });
      });
    } else if (user === null) {
      localStorage.removeItem('transactionsPrivacyLevel');
    }
  }, [user]);

  const setLevel = async (val: number) => {
    setLocalLevel(val);
    localStorage.setItem('transactionsPrivacyLevel', val.toString());
    if (user) {
      try {
        const { setUserSettings } = await import('@/lib/db');
        await setUserSettings(user.uid, { transactionsPrivacyLevel: val });
      } catch (e) {
        console.error('Failed to save transactions privacy level', e);
      }
    }
  };

  if (!isMounted) return <>{children}</>;

  return (
    <PrivacyContext.Provider value={{ privacyLevel: localLevel, setPrivacyLevel: setLevel }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>}>
      <LocalPrivacyProvider>
        <TransactionsList />
      </LocalPrivacyProvider>
    </Suspense>
  );
}
