'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Category } from '@/types';

interface SearchableCategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SearchableCategorySelect({ categories, value, onChange, disabled }: SearchableCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const filteredCategories = expenseCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const selectedCategory = expenseCategories.find(c => c.id === value);
  const displayValue = value === '' ? '總預算' : (selectedCategory?.name || '請選擇');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="sticky top-0 bg-white px-2 pb-2 pt-1 dark:bg-zinc-950">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="搜尋分類..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-transparent py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-800"
                autoFocus
              />
            </div>
          </div>
          
          <div className="px-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearch('');
              }}
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${value === '' ? 'bg-zinc-50 dark:bg-zinc-900 font-medium' : ''}`}
            >
              <span className="flex-1">總預算</span>
              {value === '' && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            </button>
            
            {filteredCategories.length > 0 ? (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1">分類預算</div>
                {filteredCategories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${value === c.id ? 'bg-zinc-50 dark:bg-zinc-900 font-medium' : ''}`}
                  >
                    <span className="flex-1">{c.name}</span>
                    {value === c.id && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </>
            ) : (
              <div className="px-2 py-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                找不到相關分類
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
