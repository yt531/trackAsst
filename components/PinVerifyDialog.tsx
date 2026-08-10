'use client';

import { useState, useEffect } from 'react';
import { useLock } from './LockProvider';

interface PinVerifyDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PinVerifyDialog({ 
  isOpen, 
  title = '驗證 PIN 碼',
  description = '請輸入 6 位數 PIN 碼以確認此操作。',
  onClose, 
  onSuccess 
}: PinVerifyDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { validatePin } = useLock();

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (pin.length !== 6) {
      setError('請輸入 6 位數 PIN 碼');
      return;
    }

    try {
      setIsLoading(true);
      const isValid = await validatePin(pin);
      if (isValid) {
        onSuccess();
        setPin(''); // Reset for next time
      } else {
        setError('PIN 碼不正確');
        setPin(''); // Clear input on error
      }
    } catch (err) {
      console.error(err);
      setError('驗證失敗，請重試。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 mb-6 dark:text-zinc-400">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="輸入 6 位數"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-4 py-3 text-center text-xl tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
            autoFocus
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError('');
                onClose();
              }}
              className="flex-1 rounded-xl bg-zinc-100 px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || pin.length !== 6}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '驗證中...' : '確認'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
