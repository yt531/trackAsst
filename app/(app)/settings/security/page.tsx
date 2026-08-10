'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, ArrowLeft, Key, Shield, Timer, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLock } from '@/components/LockProvider';
import PinSetupDialog from '@/components/PinSetupDialog';
import { isWebAuthnSupported, registerBiometric } from '@/lib/webauthn';

export default function SecurityPage() {
  const router = useRouter();
  const {
    lockScope, setLockScope,
    idleTimeout, setIdleTimeout,
    hasPin, setHasPin,
    hasBiometric, setHasBiometric,
    biometricCredentialId, setBiometricCredentialId
  } = useLock();

  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [supportWebAuthn, setSupportWebAuthn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    isWebAuthnSupported().then(setSupportWebAuthn);
  }, []);

  const handleToggleLockScope = (scope: 'global' | 'sensitive' | 'none') => {
    if (scope !== 'none' && !hasPin) {
      setIsPinSetupOpen(true);
      return; // Handled after PIN setup
    }
    setLockScope(scope);
    if (scope === 'none') {
      // Ask for PIN to disable? Ideally yes, but we keep it simple for now
    }
  };

  const handleToggleBiometric = async () => {
    setErrorMsg('');
    if (hasBiometric) {
      setHasBiometric(false);
      setBiometricCredentialId(null);
    } else {
      if (!hasPin) {
         setErrorMsg('請先設定安全鎖範圍 (設定 PIN 碼) 後，才能啟用生物辨識。');
         return;
      }
      try {
        const credentialId = await registerBiometric('FinTrack User');
        setBiometricCredentialId(credentialId);
        setHasBiometric(true);
      } catch (e: any) {
        setErrorMsg(e.message || '生物辨識設定失敗');
      }
    }
  };

  const handleDisablePin = () => {
    if (confirm('確定要關閉安全鎖並移除 PIN 碼嗎？')) {
      localStorage.removeItem('pinHash');
      setHasPin(false);
      setLockScope('none');
      setHasBiometric(false);
      setBiometricCredentialId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">安全性管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            管理應用程式的安全設定
          </p>
        </div>
      </header>

      {errorMsg && (
        <div className="rounded-xl bg-red-100 dark:bg-red-900/30 p-4 text-red-600 dark:text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">安全鎖定範圍</h2>
        
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
          
          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Shield className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">全域鎖定</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">每次開啟應用程式皆需解鎖</div>
              </div>
            </div>
            <input 
              type="radio" 
              checked={lockScope === 'global'} 
              onChange={() => handleToggleLockScope('global')}
              className="w-5 h-5 accent-blue-600" 
            />
          </label>

          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <ShieldAlert className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">僅敏感頁面</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">僅在進入設定等頁面時鎖定</div>
              </div>
            </div>
            <input 
              type="radio" 
              checked={lockScope === 'sensitive'} 
              onChange={() => handleToggleLockScope('sensitive')}
              className="w-5 h-5 accent-blue-600" 
            />
          </label>

          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
             <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Key className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">關閉安全鎖</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">不啟用任何鎖定機制</div>
              </div>
            </div>
            <input 
              type="radio" 
              checked={lockScope === 'none'} 
              onChange={() => handleToggleLockScope('none')}
              className="w-5 h-5 accent-blue-600" 
            />
          </label>

        </div>

        {hasPin && (
          <div className="flex justify-end">
            <button 
              onClick={handleDisablePin}
              className="text-sm text-red-500 hover:underline"
            >
              清除 PIN 碼並重設所有安全設定
            </button>
          </div>
        )}
      </section>

      {lockScope !== 'none' && (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">自動鎖定設定</h2>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Timer className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="font-medium">閒置自動鎖定</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">經過一段時間後自動鎖定</div>
                  </div>
                </div>
                <select 
                  value={idleTimeout}
                  onChange={(e) => setIdleTimeout(Number(e.target.value))}
                  className="bg-zinc-100 dark:bg-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>永不</option>
                  <option value={60000}>1 分鐘</option>
                  <option value={300000}>5 分鐘</option>
                  <option value={900000}>15 分鐘</option>
                  <option value={1800000}>30 分鐘</option>
                </select>
              </div>
            </div>
          </section>

          {supportWebAuthn && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">進階解鎖</h2>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <div className="flex items-center justify-between cursor-pointer" onClick={handleToggleBiometric}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <Fingerprint className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div>
                      <div className="font-medium">生物辨識解鎖</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">使用 Face ID / Touch ID 快速解鎖</div>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasBiometric ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${hasBiometric ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <PinSetupDialog 
        isOpen={isPinSetupOpen} 
        onClose={() => setIsPinSetupOpen(false)} 
        onSuccess={() => {
          setIsPinSetupOpen(false);
          // 預設切換為全域
        }}
      />
    </div>
  );
}
