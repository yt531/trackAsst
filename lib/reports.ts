import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths, addYears, eachDayOfInterval, format } from 'date-fns';
import { Transaction, Category } from '@/types';

export type ReportPeriod = 'day' | 'month' | 'year';
export type FlowType = 'expense' | 'income';

export interface Summary {
  expense: number;
  income: number;
  balance: number;
}

export interface Comparison {
  diff: number;
  // null when the previous value is 0 (a percentage cannot be computed)
  percent: number | null;
}

export function getPeriodRange(period: ReportPeriod, date: Date): { start: number; end: number } {
  switch (period) {
    case 'day':
      return { start: startOfDay(date).getTime(), end: endOfDay(date).getTime() };
    case 'month':
      return { start: startOfMonth(date).getTime(), end: endOfMonth(date).getTime() };
    case 'year':
      return { start: startOfYear(date).getTime(), end: endOfYear(date).getTime() };
  }
}

export function shiftPeriod(period: ReportPeriod, date: Date, amount: number): Date {
  switch (period) {
    case 'day':
      return addDays(date, amount);
    case 'month':
      return addMonths(date, amount);
    case 'year':
      return addYears(date, amount);
  }
}

// Whether `date` falls in the same day / month / year as today.
export function isCurrentPeriod(period: ReportPeriod, date: Date, now: Date = new Date()): boolean {
  const { start, end } = getPeriodRange(period, date);
  return now.getTime() >= start && now.getTime() <= end;
}

// Settlement (and any other type) is not a real income/expense, so it is ignored.
export function summarize(transactions: Transaction[]): Summary {
  let expense = 0;
  let income = 0;
  for (const tx of transactions) {
    if (tx.type === 'expense') expense += tx.baseAmount;
    else if (tx.type === 'income') income += tx.baseAmount;
  }
  return { expense, income, balance: income - expense };
}

export function compare(current: number, previous: number): Comparison {
  return {
    diff: current - previous,
    percent: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  };
}

export function totalsByCategory(
  transactions: Transaction[],
  type: FlowType,
  categoriesMap: Record<string, Category>
): { name: string; value: number }[] {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    totals[tx.categoryId] = (totals[tx.categoryId] || 0) + tx.baseAmount;
  }
  return Object.entries(totals)
    .map(([catId, value]) => ({ name: categoriesMap[catId]?.name || '未知', value }))
    .sort((a, b) => b.value - a.value);
}

export function dailyExpenses(transactions: Transaction[], monthDate: Date): { date: string; amount: number }[] {
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = format(new Date(tx.date), 'yyyy-MM-dd');
    totals[key] = (totals[key] || 0) + tx.baseAmount;
  }
  return days.map(day => ({ date: format(day, 'd'), amount: totals[format(day, 'yyyy-MM-dd')] || 0 }));
}

export function monthlyTotals(transactions: Transaction[]): { month: string; expense: number; income: number }[] {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}`, expense: 0, income: 0 }));
  for (const tx of transactions) {
    const m = new Date(tx.date).getMonth();
    if (tx.type === 'expense') months[m].expense += tx.baseAmount;
    else if (tx.type === 'income') months[m].income += tx.baseAmount;
  }
  return months;
}
