'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

// 新增／編輯交易時，選擇標籤、分類、支付方式共用的搜尋式選擇視窗。
// 搜尋文字與篩選由父層持有（關掉再打開仍保留搜尋字）；單選或多選、選完是否關閉也由父層的 onSelect 決定。
export function PickerModal({
  title,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  items,
  isSelected,
  onSelect,
  emptyContent,
  onClose,
  showDoneButton = false
}: {
  title: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  items: { id: string; name?: string }[];
  isSelected: (id: string) => boolean;
  onSelect: (id: string) => void;
  emptyContent: ReactNode;
  onClose: () => void;
  showDoneButton?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
          {items.length === 0 ? (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">{emptyContent}</div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const selected = isSelected(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="font-medium text-sm">{item.name}</span>
                    {selected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showDoneButton && (
          <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
