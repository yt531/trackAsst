'use client';

import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, ArrowLeft } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  const initialTheme = useRef<string | undefined>(undefined);
  const [selectedTheme, setSelectedTheme] = useState<string>('system');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (theme && !initialTheme.current) {
      initialTheme.current = theme;
      setSelectedTheme(theme);
    }
  }, [theme]);

  // Handle reverting theme if component unmounts without saving
  const selectedThemeRef = useRef(selectedTheme);
  useEffect(() => {
    selectedThemeRef.current = selectedTheme;
  }, [selectedTheme]);

  useEffect(() => {
    return () => {
      if (
        !isSavingRef.current &&
        initialTheme.current &&
        selectedThemeRef.current !== initialTheme.current
      ) {
        setTheme(initialTheme.current);
      }
    };
  }, [setTheme]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  const hasChanges = initialTheme.current ? selectedTheme !== initialTheme.current : false;

  const handleThemeSelect = (newTheme: string) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
  };

  const handleSave = () => {
    isSavingRef.current = true;
    setIsSaving(true);
    initialTheme.current = selectedTheme; // Update initial to prevent reverting
    setTimeout(() => {
      router.push('/settings');
    }, 300);
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('尚有未儲存的修改，確定要放棄修改並返回嗎？')) {
        if (initialTheme.current) {
          setTheme(initialTheme.current);
        }
        router.push('/settings');
      }
    } else {
      router.push('/settings');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={handleCancel} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">調整色彩模式</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            自訂應用程式的視覺外觀
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleThemeSelect('light')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-6 transition-all ${
              selectedTheme === 'light'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Sun className="h-8 w-8" />
            <span className="text-sm font-medium">淺色</span>
          </button>

          <button
            onClick={() => handleThemeSelect('dark')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-6 transition-all ${
              selectedTheme === 'dark'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Moon className="h-8 w-8" />
            <span className="text-sm font-medium">深色</span>
          </button>

          <button
            onClick={() => handleThemeSelect('system')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-6 transition-all ${
              selectedTheme === 'system'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Monitor className="h-8 w-8" />
            <span className="text-sm font-medium">跟隨系統</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-zinc-500 text-center">
          選擇「跟隨系統」時，會根據您裝置的系統設定自動切換淺色或深色。
        </p>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-zinc-200 dark:bg-zinc-900/95 dark:border-zinc-800 md:pl-64 flex gap-3 z-[60]">
        <button
          onClick={handleCancel}
          className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors text-zinc-900 dark:text-zinc-100"
        >
          取消設定
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`flex-1 rounded-xl py-3 text-sm font-medium text-white transition-colors ${
            hasChanges && !isSaving ? 'bg-blue-600 hover:bg-blue-700 shadow-md' : 'bg-blue-400 cursor-not-allowed dark:bg-blue-800'
          }`}
        >
          {isSaving ? '儲存設定中...' : '儲存設定'}
        </button>
      </div>
    </div>
  );
}
