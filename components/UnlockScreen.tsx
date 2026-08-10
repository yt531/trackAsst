'use client';

import { useState, useEffect, useRef } from 'react';
import { Fingerprint, Lock, CheckCircle2 } from 'lucide-react';
import { authenticateBiometric } from '@/lib/webauthn';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { setSecuritySettings } from '@/lib/db';
import { deleteField } from 'firebase/firestore';

interface UnlockScreenProps {
  onUnlock: (pin?: string) => void;
  hasBiometric: boolean;
  biometricCredentialId?: string;
  error?: string;
}

export default function UnlockScreen({
  onUnlock,
  hasBiometric,
  biometricCredentialId,
  error,
}: UnlockScreenProps) {
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // Force HMR update to catch the useRef import
  const isRequestPendingRef = useRef(false);

  // We removed the auto-trigger on mount because most modern browsers 
  // require a transient user activation (like a click) to show the WebAuthn prompt.
  // The user will click the "使用生物辨識" button manually.

  const handleBiometricUnlock = async () => {
    if (!biometricCredentialId || isRequestPendingRef.current) return;
    try {
      isRequestPendingRef.current = true;
      setIsAuthenticating(true);
      const success = await authenticateBiometric(biometricCredentialId);
      if (success) {
        onUnlock(); // Unlocked via biometrics, no PIN passed
      }
    } catch (e: any) {
      console.error('Biometric failed:', e);
      // "NotAllowedError" usually means user cancelled it, we can ignore or show message
    } finally {
      setIsAuthenticating(false);
      isRequestPendingRef.current = false;
    }
  };

  const handleForgotPin = async () => {
    if (!auth.currentUser) {
      alert('無法取得登入資訊，請重新整理頁面。');
      return;
    }
    try {
      setIsAuthenticating(true);
      // Re-authenticate user to prove identity
      await signInWithPopup(auth, googleProvider);
      
      // If success, clear PIN from Firebase
      await setSecuritySettings(auth.currentUser.uid, {
        pinHash: deleteField()
      });

      // Clear from local storage
      localStorage.removeItem('pinHash');
      localStorage.removeItem('lockScope'); // Also reset lock scope
      
      alert('已成功清除 PIN 碼，請重新設定。');
      window.location.href = '/settings/security?setup=true';
    } catch (e) {
      console.error('Failed to reset PIN', e);
      alert('驗證失敗，無法重設密碼');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      onUnlock(pin);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-xs space-y-8 p-6 text-center text-white">
        <div className="flex justify-center">
          <div className="rounded-full bg-zinc-800 p-4">
            <Lock className="h-10 w-10 text-white" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">已鎖定</h2>
          <p className="mt-2 text-sm text-zinc-400">請輸入 PIN 碼或使用生物辨識解鎖</p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="輸入 6 位數 PIN 碼"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-xl tracking-[0.5em] text-white placeholder:tracking-normal focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            autoFocus
          />
          <button
            type="submit"
            disabled={pin.length !== 6}
            className="w-full rounded-xl bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            解鎖
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        
        <div className="pt-2">
          <button 
            type="button"
            onClick={handleForgotPin}
            disabled={isAuthenticating}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            忘記 PIN 碼？
          </button>
        </div>

        {hasBiometric && biometricCredentialId && (
          <div className="pt-6">
            <button
              onClick={handleBiometricUnlock}
              disabled={isAuthenticating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 font-medium transition-colors hover:bg-zinc-800"
            >
              <Fingerprint className="h-5 w-5" />
              {isAuthenticating ? '驗證中...' : '使用生物辨識'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
