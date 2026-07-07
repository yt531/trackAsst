import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">外觀</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">

        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-all ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm font-medium">淺色</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-all ${
              theme === 'dark'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm font-medium">深色</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-all ${
              theme === 'system'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <Monitor className="h-6 w-6" />
            <span className="text-sm font-medium">跟隨系統</span>
          </button>
        </div>

      </div>
    </div>
  );
}
