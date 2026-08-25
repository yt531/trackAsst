'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import React, { useMemo } from 'react';

interface PageHeaderProps {
  title: string;
  rightAction?: React.ReactNode;
  backHref?: string; // Optional custom back route
}

export function PageHeader({ title, rightAction, backHref }: PageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { targetPath, backText } = useMemo(() => {
    let finalPath = '/';

    if (backHref) {
      finalPath = backHref;
    } else if (!pathname || pathname === '/') {
      finalPath = '/';
    } else {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length <= 1) {
        finalPath = '/';
      } else {
        finalPath = '/' + segments.slice(0, -1).join('/');
      }
    }

    return { 
      targetPath: finalPath, 
      backText: finalPath === '/' ? '返回首頁' : '返回' 
    };
  }, [pathname, backHref]);

  const handleBack = () => {
    router.push(targetPath);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-800/80 md:hidden">
      <button 
        onClick={handleBack} 
        className="flex items-center gap-1 p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-sm font-medium">{backText}</span>
      </button>
      
      <span className="font-bold text-base absolute left-1/2 -translate-x-1/2 truncate max-w-[50%]">
        {title}
      </span>

      <div className="flex items-center justify-end w-auto min-w-[60px]">
        {rightAction}
      </div>
    </header>
  );
}
