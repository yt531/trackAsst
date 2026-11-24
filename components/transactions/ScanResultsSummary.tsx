'use client';

import type { ScannedReceiptResult } from '@/lib/receipt-parser';

// 多張發票掃描完成後的結果摘要：逐筆列出辨識結果，按下按鈕後由父層開始逐筆編輯
export function ScanResultsSummary({
  scans,
  previews,
  onStartEditing
}: {
  scans: ScannedReceiptResult[];
  previews: string[];
  onStartEditing: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <p className="text-sm font-medium text-center">
          共 <span className="font-bold">{scans.length}</span> 筆，
          <span className="text-green-600 dark:text-green-400">
            {scans.filter(s => !s.incomplete).length} 筆辨識完整 ✅
          </span>
          {scans.filter(s => s.incomplete).length > 0 && (
            <>
              ，
              <span className="text-amber-600 dark:text-amber-400">
                {scans.filter(s => s.incomplete).length} 筆需補充 ⚠️
              </span>
            </>
          )}
        </p>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {scans.map((scan, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 transition-colors ${
              scan.incomplete
                ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10'
                : 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10'
            }`}
          >
            <div className="flex gap-3">
              {/* Thumbnail */}
              {previews[idx] && (
                <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <img
                    src={previews[idx]}
                    alt={`截圖 ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    明細 {idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      scan.incomplete
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {scan.incomplete ? '⚠️ 需補充' : '✅ 完整'}
                  </span>
                </div>

                {/* Recognized fields */}
                <div className="space-y-1 text-sm">
                  {scan.totalAmount !== undefined && (
                    <p className="text-base font-semibold">${scan.totalAmount}</p>
                  )}
                  {scan.location && (
                    <p className="truncate text-zinc-600 dark:text-zinc-300">
                      📍 {scan.location}
                    </p>
                  )}
                  {scan.date && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      🗓️ {scan.date.replace('T', ' ').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3')}
                    </p>
                  )}
                  {scan.items && scan.items.length > 0 && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      🛒 {scan.items[0].name}{scan.items.length > 1 ? ` 等 ${scan.items.length} 項` : ''}
                    </p>
                  )}
                </div>

                {/* Missing fields warning */}
                {scan.incomplete && scan.errors && scan.errors.length > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    請補上「{scan.errors.join('」、「')}」
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Start editing button */}
      <button
        type="button"
        onClick={onStartEditing}
        className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white transition-colors hover:bg-blue-700"
      >
        開始編輯（共 {scans.length} 筆）
      </button>
    </div>
  );
}
