import { Summary, Comparison, ReportPeriod, compare } from '@/lib/reports';
import { formatMoney } from './shared';

interface SummaryCardsProps {
  period: ReportPeriod;
  summary: Summary;
  previous: Summary;
  extra?: { label: string; value: number };
}

const PREVIOUS_LABEL: Record<ReportPeriod, string> = {
  day: '昨日',
  month: '上月',
  year: '去年',
};

const GOOD = 'text-emerald-600 dark:text-emerald-400';
const BAD = 'text-red-600 dark:text-red-400';

interface ChangeLineProps {
  period: ReportPeriod;
  comparison: Comparison;
  // Whether an increase is good (income, balance) or bad (expense)
  increaseIsGood: boolean;
  showPercent: boolean;
}

function ChangeLine({ period, comparison, increaseIsGood, showPercent }: ChangeLineProps) {
  const label = `較${PREVIOUS_LABEL[period]}`;
  if (showPercent && comparison.percent === null) {
    return <div className="mt-1 text-xs text-zinc-400">{PREVIOUS_LABEL[period]}無資料</div>;
  }
  if (comparison.diff === 0) {
    return <div className="mt-1 text-xs text-zinc-400">{label} 持平</div>;
  }
  const up = comparison.diff > 0;
  const color = up === increaseIsGood ? GOOD : BAD;
  const text = showPercent
    ? `${Math.abs(comparison.percent as number).toFixed(0)}%`
    : formatMoney(Math.abs(comparison.diff));
  return (
    <div className={`mt-1 text-xs ${color}`}>
      {label} {up ? '↑' : '↓'}{text}
    </div>
  );
}

export function SummaryCards({ period, summary, previous, extra }: SummaryCardsProps) {
  const cardClass = 'rounded-xl bg-white p-4 shadow-sm border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800';
  return (
    <div className="grid grid-cols-2 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2">
      <div className={cardClass}>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">總支出</div>
        <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{formatMoney(summary.expense)}</div>
        <ChangeLine period={period} comparison={compare(summary.expense, previous.expense)} increaseIsGood={false} showPercent />
      </div>
      <div className={cardClass}>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">總收入</div>
        <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatMoney(summary.income)}</div>
        <ChangeLine period={period} comparison={compare(summary.income, previous.income)} increaseIsGood showPercent />
      </div>
      <div className={cardClass}>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">結餘</div>
        <div className="text-2xl font-bold mt-1">{formatMoney(summary.balance)}</div>
        <ChangeLine period={period} comparison={compare(summary.balance, previous.balance)} increaseIsGood showPercent={false} />
      </div>
      {extra && (
        <div className={cardClass}>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{extra.label}</div>
          <div className="text-2xl font-bold mt-1">{formatMoney(extra.value)}</div>
        </div>
      )}
    </div>
  );
}
