import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { getDaysInMonth } from 'date-fns';
import { Transaction, Category } from '@/types';
import { summarize, dailyExpenses } from '@/lib/reports';
import { SummaryCards } from './SummaryCards';
import { CategoryPie } from './CategoryPie';
import { tooltipStyle, formatMoney, formatAxisTick } from './shared';

interface MonthlyReportProps {
  date: Date;
  transactions: Transaction[];
  previousTransactions: Transaction[];
  categoriesMap: Record<string, Category>;
}

export function MonthlyReport({ date, transactions, previousTransactions, categoriesMap }: MonthlyReportProps) {
  const summary = summarize(transactions);
  const dailyData = dailyExpenses(transactions, date);

  return (
    <div className="@container space-y-6">
      <SummaryCards
        period="month"
        summary={summary}
        previous={summarize(previousTransactions)}
        extra={{ label: '日平均支出', value: summary.expense / getDaysInMonth(date) }}
      />

      <div className="grid @2xl:grid-cols-2 gap-6">
        <CategoryPie transactions={transactions} categoriesMap={categoriesMap} />

        <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="font-semibold mb-6">每日支出</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickMargin={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={formatAxisTick} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  formatter={(value: any) => [formatMoney(Number(value)), '支出']}
                  labelFormatter={(label) => `${label}日`}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
