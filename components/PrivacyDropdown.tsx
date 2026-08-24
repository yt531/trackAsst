'use client';

import { useState, useRef, useEffect } from 'react';
import { usePrivacy } from '@/components/PrivacyProvider';

const options = [
  { value: 0, emoji: '👀', label: '顯示全部', description: '顯示所有金額' },
  { value: 1, emoji: '🫣', label: '隱藏預算', description: '僅隱藏預算金額' },
  { value: 2, emoji: '😎', label: '隱藏預算與收支', description: '僅顯示明細金額' },
  { value: 3, emoji: '🙈', label: '隱藏全部', description: '隱藏所有金額' },
];

export function PrivacyDropdown({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const { privacyLevel, setPrivacyLevel } = usePrivacy();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentOption = options.find((opt) => opt.value === privacyLevel) || options[0];

  return (
    <div className={`relative ${variant === 'full' ? 'w-full' : ''}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          variant === 'icon'
            ? 'flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none'
            : 'w-full flex items-center justify-between bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-lg px-4 py-3 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 focus:outline-none transition-colors'
        }
        title="切換防窺模式"
      >
        {variant === 'icon' ? (
          <span className="text-xl leading-none">{currentOption.emoji}</span>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-lg leading-none">{currentOption.emoji}</span>
              <span>{currentOption.label}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white/95 backdrop-blur-md shadow-xl dark:border-zinc-700 dark:bg-zinc-800/95 overflow-hidden ${variant === 'icon' ? 'right-0 top-full origin-top-right' : 'bottom-full mb-2 left-0 origin-bottom-left'
            }`}
        >
          <div className="p-2 space-y-1">
            <div className="px-2 py-1.5 mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              防窺程度
            </div>
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPrivacyLevel(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all duration-200 ${privacyLevel === option.value
                    ? 'bg-blue-50/80 dark:bg-blue-900/30'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                  }`}
              >
                <span className="text-xl mt-0.5">{option.emoji}</span>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${privacyLevel === option.value ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {option.label}
                  </span>
                  <span className={`text-xs mt-0.5 ${privacyLevel === option.value ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {option.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
