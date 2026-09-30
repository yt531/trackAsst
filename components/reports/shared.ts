export const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)'
];

export const tooltipStyle = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };

export const formatMoney = (value: number) => `NT$ ${Math.round(value).toLocaleString()}`;

export const formatAxisTick = (val: number) => (val === 0 ? '' : val / 1000 >= 1 ? `${val / 1000}k` : String(val));
