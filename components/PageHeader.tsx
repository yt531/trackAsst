'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import React from 'react';

interface PageHeaderProps {
  title: string;
  rightAction?: React.ReactNode;
  backHref?: string; // Optional custom back route
}

export function PageHeader({ title, rightAction, backHref }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-800/80 md:hidden">
      <button 
        onClick={handleBack} 
        className="flex items-center gap-1 p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-sm font-medium">返回</span>
      </button>
      
      <span className="font-bold text-base absolute left-1/2 -translate-x-1/2 truncate max-w-[50%]">
        {title}
      </span>

      <div className="flex items-center justify-end w-[60px]">
        {rightAction}
      </div>
    </header>
  );
}
