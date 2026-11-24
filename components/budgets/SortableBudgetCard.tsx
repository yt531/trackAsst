'use client';
import { format } from 'date-fns';
import { Wallet, Pencil, Trash2, GripVertical, Settings } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import type { Budget, Transaction } from '@/types';

interface SortableBudgetCardProps {
  budget: Budget;
  categoryName: string;
  selectedMonth: string;
  transactions: Transaction[];
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onConfigRules?: (budget: Budget) => void;
  ledgerId?: string; // 有值＝共享帳本的預算卡片（連結、金額後備值、版面略有不同）
  isReorderMode?: boolean;
}

export function SortableBudgetCard({ budget, categoryName, selectedMonth, transactions, onEdit, onDelete, onConfigRules, ledgerId, isReorderMode }: SortableBudgetCardProps) {
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

  const filterMode = budget.period === 'daily' ? 'day' : budget.period === 'yearly' ? 'year' : budget.period === 'weekly' ? 'week' : 'month';
  const catQuery = budget.categoryId ? `&categoryId=${budget.categoryId}` : '';
  
  const isCurrentMonth = selectedMonth === format(new Date(), 'yyyy-MM');
  let dateQuery = selectedMonth;
  if (budget.period === 'yearly') {
    dateQuery = selectedMonth.substring(0, 4);
  } else if (budget.period === 'daily') {
    dateQuery = isCurrentMonth ? format(new Date(), 'yyyy-MM-dd') : `${selectedMonth}-01`;
  } else if (budget.period === 'weekly') {
    dateQuery = selectedMonth;
  }
  
  const txUrl = ledgerId
    ? `/ledgers/detail/transactions?id=${ledgerId}&filterMode=${filterMode}&date=${dateQuery}${catQuery}`
    : `/transactions?filterMode=${filterMode}&date=${dateQuery}${catQuery}`;

  // 共享帳本的交易可能沒有 baseAmount，改用 amount 作後備；個人帳維持原行為
  const amountOf = (t: Transaction) => (ledgerId ? (t.baseAmount || t.amount) : t.baseAmount);

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
        rawSpent += amountOf(t);
      } else if (rule === 'addition') {
        additions += amountOf(t);
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
    if (budget.period === 'monthly' || budget.period === 'yearly' || budget.period === 'weekly') {
      spent = categoryTxs.reduce((sum, t) => sum + amountOf(t), 0);
    } else {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const isCurrentMonth = selectedMonth === format(today, 'yyyy-MM');
      if (isCurrentMonth) {
        const todayTxs = categoryTxs.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === todayStr);
        spent = todayTxs.reduce((sum, t) => sum + amountOf(t), 0);
      } else {
        const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
        const totalSpent = categoryTxs.reduce((sum, t) => sum + amountOf(t), 0);
        spent = Math.round(totalSpent / daysInMonth);
      }
    }
  }

  const percent = targetAmount > 0 ? Math.min(100, Math.round((spent / targetAmount) * 100)) : 0;
  const isOverBudget = spent > targetAmount;

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 transition-colors hover:border-blue-300 dark:hover:border-blue-800 flex">
      {/* Drag Handle */}
      {isReorderMode && (
        <div 
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-8 cursor-grab touch-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 rounded-l-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      )}

      <div className={`flex-1 ${isReorderMode ? 'ml-4' : ''} relative`}>
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
                  {budget.period === 'monthly' ? '每月預算' : budget.period === 'yearly' ? '每年預算' : budget.period === 'weekly' ? '每週預算' : '每日預算'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between items-baseline mb-2">
              <div className={`text-2xl font-bold text-zinc-900 dark:text-zinc-50${ledgerId ? ' flex items-baseline gap-1' : ''}`}>
                ${spent.toLocaleString()}
              </div>
              <div className={`text-sm text-zinc-500 dark:text-zinc-400${ledgerId ? ' flex items-baseline gap-1' : ''}`}>
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
