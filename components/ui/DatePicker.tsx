'use client';

import { format, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear } from 'date-fns';
import dynamic from 'next/dynamic';
import 'flatpickr/dist/flatpickr.min.css';
import { MandarinTraditional } from 'flatpickr/dist/l10n/zh-tw.js';
import weekSelectPlugin from 'flatpickr/dist/plugins/weekSelect/weekSelect.js';

const Flatpickr = dynamic(() => import('react-flatpickr'), { ssr: false });

type DatePickerProps = {
  type?: 'date' | 'month' | 'datetime-local' | 'year' | 'week';
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  showTodayButton?: boolean;
};

export function DatePicker({ type = 'date', value, onChange, required, className, showTodayButton = true }: DatePickerProps) {
  const handleToday = () => {
    const now = new Date();
    if (type === 'year') {
      onChange(format(now, 'yyyy'));
    } else if (type === 'week') {
      const year = getISOWeekYear(now);
      const week = getISOWeek(now);
      onChange(`${year}-W${String(week).padStart(2, '0')}`);
    } else if (type === 'month') {
      onChange(format(now, 'yyyy-MM'));
    } else if (type === 'datetime-local') {
      onChange(format(now, "yyyy-MM-dd'T'HH:mm"));
    } else {
      onChange(format(now, 'yyyy-MM-dd'));
    }
  };

  const isFlatpickr = type === 'datetime-local' || type === 'date' || type === 'week';

  let parsedValue: string | Date = value;
  if (type === 'week' && value && typeof value === 'string') {
    const [y, w] = value.split('-W');
    if (y && w) {
      let d = setISOWeekYear(new Date(), parseInt(y, 10));
      parsedValue = setISOWeek(d, parseInt(w, 10));
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {isFlatpickr ? (
        <Flatpickr
          value={parsedValue}
          onChange={(dates) => {
            if (dates.length > 0) {
              if (type === 'datetime-local') {
                onChange(format(dates[0], "yyyy-MM-dd'T'HH:mm"));
              } else if (type === 'week') {
                const year = getISOWeekYear(dates[0]);
                const week = getISOWeek(dates[0]);
                onChange(`${year}-W${String(week).padStart(2, '0')}`);
              } else {
                onChange(format(dates[0], 'yyyy-MM-dd'));
              }
            }
          }}
          options={{
            // enableTime: type === 'datetime-local',
            enableTime: false, // 先註解時間選項，只保留日期
            time_24hr: true,
            // dateFormat: type === 'datetime-local' ? 'Y-m-d H:i' : 'Y-m-d',
            dateFormat: 'Y-m-d',
            locale: {
              ...MandarinTraditional,
              firstDayOfWeek: 1,
            },
            plugins: type === 'week' ? [new (weekSelectPlugin as any)({})] : [],
          }}
          className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          required={required}
        />
      ) : (
        <input
          type={type === 'year' ? 'number' : type}
          required={required}
          value={value}
          min={type === 'year' ? 2000 : undefined}
          max={type === 'year' ? 2100 : undefined}
          step={type === 'year' ? 1 : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}
      {showTodayButton && (
        <button
          type="button"
          onClick={handleToday}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
        >
          {type === 'year' ? '今年' : type === 'week' ? '本週' : type === 'month' ? '本月' : '今天'}
        </button>
      )}
    </div>
  );
}
