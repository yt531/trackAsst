'use client';

import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReportPeriod, shiftPeriod, isCurrentPeriod } from '@/lib/reports';

interface PeriodNavigatorProps {
  period: ReportPeriod;
  date: Date;
  onChange: (date: Date) => void;
}

const EARLIEST_YEAR = 2000;

const LABEL_FORMAT: Record<ReportPeriod, string> = {
  day: 'yyyy年MM月dd日',
  month: 'yyyy年MM月',
  year: 'yyyy年',
};

export function PeriodNavigator({ period, date, onChange }: PeriodNavigatorProps) {
  const today = new Date();
  const atCurrent = isCurrentPeriod(period, date, today);

  // Parse the native input value as a local date (avoid `new Date('yyyy-MM-dd')`, which is UTC).
  const handleNativeChange = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    const next = new Date(y, (m || 1) - 1, d || 1);
    onChange(next.getTime() > today.getTime() ? today : next);
  };

  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // showPicker is unavailable or blocked; the native control still handles taps.
    }
  };

  const overlayClass = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';
  const years = Array.from({ length: today.getFullYear() - EARLIEST_YEAR + 1 }, (_, i) => today.getFullYear() - i);

  return (
    <div className="flex items-center gap-2 rounded-xl bg-white p-1 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 w-fit">
      <button
        onClick={() => onChange(shiftPeriod(period, date, -1))}
        className="p-2 hover:bg-zinc-100 rounded-lg dark:hover:bg-zinc-700"
        aria-label="上一期"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="relative min-w-[140px] text-center font-medium">
        <span>{format(date, LABEL_FORMAT[period])}</span>
        {period === 'day' && (
          <input
            type="date"
            value={format(date, 'yyyy-MM-dd')}
            max={format(today, 'yyyy-MM-dd')}
            onClick={openPicker}
            onChange={(e) => handleNativeChange(e.target.value)}
            className={overlayClass}
            aria-label="選擇日期"
          />
        )}
        {period === 'month' && (
          <input
            type="month"
            value={format(date, 'yyyy-MM')}
            max={format(today, 'yyyy-MM')}
            onClick={openPicker}
            onChange={(e) => handleNativeChange(`${e.target.value}-01`)}
            className={overlayClass}
            aria-label="選擇月份"
          />
        )}
        {period === 'year' && (
          <select
            value={date.getFullYear()}
            onChange={(e) => {
              const next = new Date(Number(e.target.value), date.getMonth(), 1);
              onChange(next.getTime() > today.getTime() ? today : next);
            }}
            className={overlayClass}
            aria-label="選擇年份"
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">{y}年</option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={() => onChange(shiftPeriod(period, date, 1))}
        disabled={atCurrent}
        className="p-2 hover:bg-zinc-100 rounded-lg dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="下一期"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
