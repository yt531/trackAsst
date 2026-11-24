'use client';

import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// 公積金支出分佈（圓餅圖與圖例）；沒有資料時不顯示
export function ExpenseBreakdownChart({ categoryData }: { categoryData: { name: string; value: number }[] }) {
  if (categoryData.length === 0) return null;

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-bold">支出分佈</h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any) => typeof value === 'number' ? `$${value.toLocaleString()}` : `$${value}`}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {categoryData.map((cat, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span>{cat.name} (${cat.value.toLocaleString()})</span>
          </div>
        ))}
      </div>
    </section>
  );
}
