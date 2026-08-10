'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getBudgetsByMonth, saveBudget, deleteBudget, updateBudgetOrders } from '@/lib/budget';
import type { Budget, Category, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, getUserCollection } from '@/lib/db';
import { format } from 'date-fns';
import { Plus, Wallet, Pencil, Trash2, GripVertical, Settings } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { DatePicker } from '@/components/ui/DatePicker';
import { SearchableCategorySelect } from '@/components/ui/SearchableCategorySelect';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableBudgetCardProps {
  budget: Budget;
  categoryName: string;
  selectedMonth: string;
  transactions: Transaction[];
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onConfigRules?: (budget: Budget) => void;
}

function SortableBudgetCard({ budget, categoryName, selectedMonth, transactions, onEdit, onDelete, onConfigRules }: SortableBudgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: budget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const filterMode = budget.period === 'daily' ? 'day' : 'month';
  const catQuery = budget.categoryId ? `&categoryId=${budget.categoryId}` : '';
  const txUrl = `/transactions?filterMode=${filterMode}&date=${selectedMonth}${catQuery}`;

  let spent = 0;
  let targetAmount = budget.amount;

  if (!budget.categoryId) {
    let relevantTxs = transactions;
    if (budget.period === 'daily') {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const isCurrentMonth = selectedMonth === format(today, 'yyyy-MM');
      if (isCurrentMonth) {
        relevantTxs = relevantTxs.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === todayStr);
      }
    }

    let rawSpent = 0;
    let additions = 0;

    relevantTxs.forEach(t => {
      const defaultRule = t.type === 'expense' ? 'deduction' : 'none';
      const rule = budget.categoryRules?.[t.categoryId] || defaultRule;

      if (rule === 'deduction') {
        rawSpent += t.baseAmount;
      } else if (rule === 'addition') {
        additions += t.baseAmount;
      }
    });

    if (budget.period === 'daily' && selectedMonth !== format(new Date(), 'yyyy-MM')) {
      const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
      spent = Math.round(rawSpent / daysInMonth);
      const avgAddition = Math.round(additions / daysInMonth);
      targetAmount += avgAddition;
    } else {
      spent = rawSpent;
      targetAmount += additions;
    }
  } else {
    const categoryTxs = transactions.filter(t => t.type === 'expense' && t.categoryId === budget.categoryId);
    if (budget.period === 'monthly') {
      spent = categoryTxs.reduce((sum, t) => sum + t.baseAmount, 0);
    } else {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const isCurrentMonth = selectedMonth === format(today, 'yyyy-MM');
      if (isCurrentMonth) {
        const todayTxs = categoryTxs.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === todayStr);
        spent = todayTxs.reduce((sum, t) => sum + t.baseAmount, 0);
      } else {
        const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
        const totalSpent = categoryTxs.reduce((sum, t) => sum + t.baseAmount, 0);
        spent = Math.round(totalSpent / daysInMonth);
      }
    }
  }

  const percent = targetAmount > 0 ? Math.min(100, Math.round((spent / targetAmount) * 100)) : 0;
  const isOverBudget = spent > targetAmount;

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 transition-colors hover:border-blue-300 dark:hover:border-blue-800 flex">
      {/* Drag Handle */}
      <div 
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-8 cursor-grab touch-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 rounded-l-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 ml-4 relative">
        {/* Actions (Edit / Delete / Config) */}
        <div className="absolute -top-1 -right-1 flex gap-1 z-10">
          {!budget.categoryId && onConfigRules && (
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfigRules(budget); }}
              className="p-1.5 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
              title="設定計入規則"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(budget); }}
            className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="修改預算"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(budget.id); }}
            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="刪除預算"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <Link href={txUrl} className="block w-full h-full pt-1 pr-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${!budget.categoryId ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {categoryName}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {budget.period === 'monthly' ? '每月預算' : '每日預算'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between items-baseline mb-2">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                ${spent.toLocaleString()}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                / ${targetAmount.toLocaleString()}
              </div>
            </div>
            
            <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            
            <div className={`mt-1.5 text-xs font-medium ${isOverBudget ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
              {percent}% {isOverBudget && '(已超支)'}
            </div>
          </div>
          
        </Link>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'daily' | 'monthly'>('monthly');
  const [categoryId, setCategoryId] = useState<string>(''); // empty means 'total'
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  
  // Config Rules State
  const [configBudgetId, setConfigBudgetId] = useState<string | null>(null);
  const [categoryRules, setCategoryRules] = useState<Record<string, 'deduction' | 'addition' | 'none'>>({});
  const [configSearchQuery, setConfigSearchQuery] = useState('');
  const [configFilterRule, setConfigFilterRule] = useState<'all' | 'deduction' | 'addition' | 'none'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    if (!user) return;

    setBudgets((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      
      // Update order property
      const updatedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
      
      // Save to db in background
      const updates = updatedItems.map(item => ({ id: item.id, order: item.order as number }));
      updateBudgetOrders(user.uid, updates).catch(e => console.error("Error updating budget orders", e));

      return updatedItems;
    });
  };

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch budgets
        const fetchedBudgets = await getBudgetsByMonth(user.uid, selectedMonth);
        // Ensure order is preserved or initialized
        fetchedBudgets.forEach((b, idx) => {
          if (b.order === undefined) b.order = idx;
        });
        fetchedBudgets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setBudgets(fetchedBudgets);

        // Fetch custom categories
        const catRef = getUserCollection(user.uid, COLLECTIONS.CATEGORIES);
        const catSnap = await getDocs(catRef);
        const customCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(mergeCategories(DEFAULT_CATEGORIES as Category[], customCats));

        // Fetch transactions for the selected month to calculate spent amount
        const [year, monthStr] = selectedMonth.split('-');
        const start = new Date(Number(year), Number(monthStr) - 1, 1).getTime();
        const end = new Date(Number(year), Number(monthStr), 0, 23, 59, 59, 999).getTime();

        const txQuery = query(
          collection(db, 'users', user.uid, 'transactions'),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        const txSnap = await getDocs(txQuery);
        setMonthTransactions(txSnap.docs.map(d => d.data() as Transaction));

      } catch (error) {
        console.error('Error fetching budgets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, selectedMonth]);

  const handleOpenForm = (budget?: Budget) => {
    if (budget) {
      setAmount(budget.amount.toString());
      setPeriod(budget.period);
      setCategoryId(budget.categoryId || '');
      setEditingBudgetId(budget.id);
    } else {
      setAmount('');
      setPeriod('monthly');
      setCategoryId('');
      setEditingBudgetId(null);
    }
    setIsFormOpen(true);
  };

  const handleOpenConfig = (budget: Budget) => {
    setConfigBudgetId(budget.id);
    setCategoryRules(budget.categoryRules || {});
    setConfigSearchQuery('');
    setConfigFilterRule('all');
  };

  const handleSaveConfig = async () => {
    if (!user || !configBudgetId) return;
    try {
      const existing = budgets.find(b => b.id === configBudgetId);
      if (!existing) return;
      
      const updatedBudget = await saveBudget(user.uid, {
        userId: existing.userId,
        amount: existing.amount,
        period: existing.period,
        month: existing.month,
        categoryId: existing.categoryId,
        order: existing.order,
        categoryRules
      });
      
      setBudgets(prev => prev.map(b => b.id === configBudgetId ? updatedBudget : b));
      setConfigBudgetId(null);
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    // 檢查是否已經存在相同分類與週期的預算 (排除目前正在編輯的項目)
    const targetCategoryId = categoryId || undefined;
    const isDuplicate = budgets.some(b => 
      b.categoryId === targetCategoryId && 
      b.period === period && 
      b.id !== editingBudgetId
    );

    if (isDuplicate) {
      alert('該預算類型已經存在相同的預算週期設定，請直接修改現有預算。');
      return;
    }

    try {
      let currentOrder = budgets.length;
      if (editingBudgetId) {
        const existing = budgets.find(b => b.id === editingBudgetId);
        if (existing && existing.order !== undefined) {
          currentOrder = existing.order;
        }
      }

      const newBudget = await saveBudget(user.uid, {
        userId: user.uid,
        amount: Number(amount),
        period,
        month: selectedMonth,
        categoryId: categoryId || undefined,
        order: currentOrder,
      });

      if (editingBudgetId && editingBudgetId !== newBudget.id) {
        await deleteBudget(user.uid, editingBudgetId);
      }

      setBudgets(prev => {
        const filtered = prev.filter(b => 
          b.id !== newBudget.id && 
          b.id !== editingBudgetId &&
          !(b.categoryId === newBudget.categoryId && b.period === newBudget.period)
        );
        const newArray = [...filtered, newBudget];
        newArray.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return newArray;
      });

      setIsFormOpen(false);
      setAmount('');
      setCategoryId('');
      setPeriod('monthly');
      setEditingBudgetId(null);
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('儲存失敗');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!user || !confirm('確定要刪除這個預算嗎？')) return;
    try {
      await deleteBudget(user.uid, budgetId);
      setBudgets(prev => prev.filter(b => b.id !== budgetId));
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const getCategoryName = (id?: string) => {
    if (!id) return '總預算';
    return categories.find(c => c.id === id)?.name || '未知分類';
  };

  const monthlyBudgets = budgets.filter(b => b.period === 'monthly');
  const dailyBudgets = budgets.filter(b => b.period === 'daily');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">預算管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">設定並追蹤您的花費目標</p>
        </div>
        <DatePicker 
          type="month" 
          value={selectedMonth}
          onChange={(val) => setSelectedMonth(val)}
        />
      </div>

      <div className="flex justify-end">
         <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新增預算
          </button>
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">{editingBudgetId ? '修改預算' : '設定預算'}</h2>
          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">預算類型</label>
                <SearchableCategorySelect
                  categories={categories}
                  value={categoryId}
                  onChange={(val) => setCategoryId(val)}
                  disabled={!!editingBudgetId}
                />
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

      {configBudgetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">設定總預算計入規則</h2>
            
            <div className="mb-4 space-y-3">
              <input
                type="text"
                placeholder="搜尋預算類型..."
                value={configSearchQuery}
                onChange={(e) => setConfigSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {(['all', 'deduction', 'addition', 'none'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setConfigFilterRule(f)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      configFilterRule === f
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {f === 'all' ? '全部類型' : f === 'deduction' ? '減項 (-)' : f === 'addition' ? '增項 (+)' : '不列入'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {categories
                .filter(cat => {
                  const matchesSearch = cat.name.toLowerCase().includes(configSearchQuery.toLowerCase());
                  if (!matchesSearch) return false;
                  if (configFilterRule === 'all') return true;
                  const defaultRule = cat.type === 'expense' ? 'deduction' : 'none';
                  const currentRule = categoryRules[cat.id] || defaultRule;
                  return currentRule === configFilterRule;
                })
                .map(cat => {
                const defaultRule = cat.type === 'expense' ? 'deduction' : 'none';
                const currentRule = categoryRules[cat.id] || defaultRule;
                return (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                    </div>
                    <select
                      value={currentRule}
                      onChange={(e) => setCategoryRules(prev => ({ ...prev, [cat.id]: e.target.value as 'deduction' | 'addition' | 'none' }))}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-zinc-600 dark:bg-zinc-900"
                    >
                      <option value="deduction">減項 (-)</option>
                      <option value="addition">增項 (+)</option>
                      <option value="none">不計入</option>
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setConfigBudgetId(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Switcher */}
      <div className="flex w-full sm:w-64 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          onClick={() => setViewMode('monthly')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300'}`}
        >
          月預算
        </button>
        <button
          onClick={() => setViewMode('daily')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300'}`}
        >
          日預算
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>
      ) : budgets.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <Wallet className="mb-2 h-8 w-8 text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">此月份尚無設定預算</p>
        </div>
      ) : (
        <div className="space-y-8">
          {viewMode === 'monthly' && (
            monthlyBudgets.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid gap-4 md:grid-cols-2">
                  <SortableContext items={monthlyBudgets.map(b => b.id)} strategy={rectSortingStrategy}>
                    {monthlyBudgets.map(budget => (
                      <SortableBudgetCard
                        key={budget.id}
                        budget={budget}
                        categoryName={getCategoryName(budget.categoryId)}
                        selectedMonth={selectedMonth}
                        transactions={monthTransactions}
                        onEdit={handleOpenForm}
                        onDelete={handleDeleteBudget}
                        onConfigRules={handleOpenConfig}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                <Wallet className="mb-2 h-8 w-8 text-zinc-400" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">尚無月預算設定</p>
              </div>
            )
          )}

          {viewMode === 'daily' && (
            dailyBudgets.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid gap-4 md:grid-cols-2">
                  <SortableContext items={dailyBudgets.map(b => b.id)} strategy={rectSortingStrategy}>
                    {dailyBudgets.map(budget => (
                      <SortableBudgetCard
                        key={budget.id}
                        budget={budget}
                        categoryName={getCategoryName(budget.categoryId)}
                        selectedMonth={selectedMonth}
                        transactions={monthTransactions}
                        onEdit={handleOpenForm}
                        onDelete={handleDeleteBudget}
                        onConfigRules={handleOpenConfig}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                <Wallet className="mb-2 h-8 w-8 text-zinc-400" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">尚無日預算設定</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
