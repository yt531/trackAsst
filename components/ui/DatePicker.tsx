'use client';

import { format } from 'date-fns';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

type DatePickerProps = {
  type?: 'date' | 'month' | 'datetime-local' | 'year';
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
};

export function DatePicker({ type = 'date', value, onChange, required, className }: DatePickerProps) {
  const handleToday = () => {
    const now = new Date();
    if (type === 'year') {
      onChange(format(now, 'yyyy'));
    } else if (type === 'month') {
      onChange(format(now, 'yyyy-MM'));
    } else if (type === 'datetime-local') {
      onChange(format(now, "yyyy-MM-dd'T'HH:mm"));
    } else {
      onChange(format(now, 'yyyy-MM-dd'));
    }
  };

  const isFlatpickr = type === 'datetime-local' || type === 'date';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {isFlatpickr ? (
        <Flatpickr
          value={value}
          onChange={(dates) => {
            if (dates.length > 0) {
              if (type === 'datetime-local') {
                onChange(format(dates[0], "yyyy-MM-dd'T'HH:mm"));
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
          }}
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          required={required}
        />
      ) : (
        <input
          type={type === 'year' ? 'number' : type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}
      <button
        type="button"
        onClick={handleToday}
        className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
      >
        {type === 'year' ? '今年' : type === 'month' ? '本月' : '今天'}
      </button>
    </div>
  );
}
