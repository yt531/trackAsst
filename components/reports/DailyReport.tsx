import { format } from 'date-fns';
import { Transaction, Category } from '@/types';
import { summarize } from '@/lib/reports';
import { SummaryCards } from './SummaryCards';
import { CategoryPie } from './CategoryPie';
import { formatMoney } from './shared';

interface DailyReportProps {
  transactions: Transaction[];
  previousTransactions: Transaction[];
  categoriesMap: Record<string, Category>;
}

export function DailyReport({ transactions, previousTransactions, categoriesMap }: DailyReportProps) {
  const list = transactions
    .filter(tx => tx.type === 'expense' || tx.type === 'income')
    .sort((a, b) => a.date - b.date);

  return (
    <div className="@container space-y-6">
      <SummaryCards period="day" summary={summarize(transactions)} previous={summarize(previousTransactions)} />

      <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="font-semibold mb-4">交易明細</h3>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {list.map(tx => {
            const isExpense = tx.type === 'expense';
            const note = tx.details || tx.notes;
            return (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{categoriesMap[tx.categoryId]?.name || '未知'}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {format(new Date(tx.date), 'HH:mm')}{note ? ` · ${note}` : ''}
                  </div>
                </div>
                <div className={`shrink-0 font-semibold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isExpense ? '-' : '+'}{formatMoney(tx.baseAmount)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <CategoryPie transactions={transactions} categoriesMap={categoriesMap} />
    </div>
  );
}
