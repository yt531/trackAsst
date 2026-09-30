'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Transaction, Category } from '@/types';
import { FlowType, totalsByCategory } from '@/lib/reports';
import { COLORS, tooltipStyle, formatMoney } from './shared';

interface CategoryPieProps {
  transactions: Transaction[];
  categoriesMap: Record<string, Category>;
}

export function CategoryPie({ transactions, categoriesMap }: CategoryPieProps) {
  const [flow, setFlow] = useState<FlowType>('expense');
  const data = totalsByCategory(transactions, flow, categoriesMap);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold">各分類{flow === 'expense' ? '支出' : '收入'}</h3>
        <div className="flex rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-700">
          {(['expense', 'income'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFlow(f)}
              className={`rounded-md px-3 py-1 font-medium ${flow === f ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              {f === 'expense' ? '支出' : '收入'}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
          此期間無{flow === 'expense' ? '支出' : '收入'}紀錄
        </div>
      ) : (
        <>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-3">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="truncate flex-1">{entry.name}</span>
                <span className="font-medium text-zinc-500 dark:text-zinc-400 ml-1">{Math.round((entry.value / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
