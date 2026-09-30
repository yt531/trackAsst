import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { Transaction, Category } from '@/types';
import { summarize, monthlyTotals } from '@/lib/reports';
import { SummaryCards } from './SummaryCards';
import { CategoryPie } from './CategoryPie';
import { tooltipStyle, formatMoney, formatAxisTick } from './shared';

interface YearlyReportProps {
  transactions: Transaction[];
  previousTransactions: Transaction[];
  categoriesMap: Record<string, Category>;
}

const SERIES_NAMES: Record<string, string> = { expense: '支出', income: '收入' };

export function YearlyReport({ transactions, previousTransactions, categoriesMap }: YearlyReportProps) {
  const summary = summarize(transactions);
  const monthlyData = monthlyTotals(transactions);

  return (
    <div className="@container space-y-6">
      <SummaryCards
        period="year"
        summary={summary}
        previous={summarize(previousTransactions)}
        extra={{ label: '月平均支出', value: summary.expense / 12 }}
      />

      <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="font-semibold mb-6">每月收支對比</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickMargin={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={formatAxisTick} />
              <RechartsTooltip
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                formatter={(value: any, name: any) => [formatMoney(Number(value)), SERIES_NAMES[name] ?? name]}
                labelFormatter={(label) => `${label}月`}
                contentStyle={tooltipStyle}
              />
              <Legend formatter={(value) => SERIES_NAMES[value] ?? value} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <CategoryPie transactions={transactions} categoriesMap={categoriesMap} />
    </div>
  );
}
