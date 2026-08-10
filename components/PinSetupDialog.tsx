'use client';

import { useState } from 'react';
import { deriveKey } from '@/lib/crypto';
import { useLock } from './LockProvider';

interface PinSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PinSetupDialog({ isOpen, onClose, onSuccess }: PinSetupDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setHasPin, setLockScope } = useLock();

  if (!isOpen) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 6) {
      setError('請輸入 6 位數 PIN 碼');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (confirmPin !== pin) {
      setError('PIN 碼不一致，請重新確認');
      return;
    }

    try {
      setIsLoading(true);
      // Generate a salt and hash the PIN
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(pin, salt);
      const rawKey = await window.crypto.subtle.exportKey('raw', key);
      
      const saltBase64 = btoa(String.fromCharCode(...salt));
      const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

      localStorage.setItem('pinHash', JSON.stringify({ saltBase64, hashBase64 }));
      
      setHasPin(true);
      if (localStorage.getItem('lockScope') === 'none' || !localStorage.getItem('lockScope')) {
         setLockScope('global'); // Default to global lock when first enabled
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError('設定失敗，請重試。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          {step === 1 ? '設定 PIN 碼' : '再次確認 PIN 碼'}
        </h2>
        <p className="text-sm text-zinc-500 mb-6 dark:text-zinc-400">
          設定 6 位數字作為備用解鎖方式，這將用於保護您的資料。
        </p>

        <form onSubmit={step === 1 ? handleNext : handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={step === 1 ? pin : confirmPin}
            onChange={(e) => step === 1 ? setPin(e.target.value) : setConfirmPin(e.target.value)}
            placeholder="輸入 6 位數"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-4 py-3 text-center text-xl tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
            autoFocus
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setConfirmPin('');
                } else {
                  onClose();
                }
              }}
              className="flex-1 rounded-xl bg-zinc-100 px-4 py-3 font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              {step === 2 ? '上一步' : '取消'}
            </button>
            <button
              type="submit"
              disabled={isLoading || (step === 1 ? pin.length !== 6 : confirmPin.length !== 6)}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '處理中...' : step === 1 ? '下一步' : '完成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
