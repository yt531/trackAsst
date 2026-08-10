'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, ArrowLeft, Key, Shield, Timer, ShieldAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLock } from '@/components/LockProvider';
import PinSetupDialog from '@/components/PinSetupDialog';
import PinVerifyDialog from '@/components/PinVerifyDialog';
import { isWebAuthnSupported, registerBiometric } from '@/lib/webauthn';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { setSecuritySettings, getUserSettings, setUserSettings } from '@/lib/db';
import { deleteField } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';

export default function SecurityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    lockScope, setLockScope,
    idleTimeout, setIdleTimeout,
    hasPin, setHasPin,
    hasBiometric, setHasBiometric,
    biometricCredentialId, setBiometricCredentialId
  } = useLock();

  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [isPinVerifyOpen, setIsPinVerifyOpen] = useState(false);
  const [supportWebAuthn, setSupportWebAuthn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [defaultPrivacyLevel, setDefaultPrivacyLevel] = useState<number>(0);

  useEffect(() => {
    isWebAuthnSupported().then(setSupportWebAuthn);
    if (searchParams.get('setup') === 'true') {
      setIsPinSetupOpen(true);
      // Clean up the URL to prevent reopening on reload
      router.replace('/settings/security');
    }
    
    // Load default privacy level
    if (auth.currentUser) {
      getUserSettings(auth.currentUser.uid).then(settings => {
        if (settings && settings.defaultPrivacyLevel !== undefined) {
          setDefaultPrivacyLevel(settings.defaultPrivacyLevel);
        }
      });
    }
  }, [searchParams, router]);

  const handlePrivacyLevelChange = async (level: number) => {
    setDefaultPrivacyLevel(level);
    if (auth.currentUser) {
      try {
        await setUserSettings(auth.currentUser.uid, { defaultPrivacyLevel: level });
        localStorage.setItem('cachedDefaultPrivacyLevel', level.toString());
      } catch (e) {
        console.error('Failed to update privacy level', e);
      }
    }
  };

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

  const handleDisablePinClick = () => {
    setIsPinVerifyOpen(true);
  };

  const handleDisablePinConfirm = async () => {
    setIsPinVerifyOpen(false);
    localStorage.removeItem('pinHash');
    setHasPin(false);
    setLockScope('none');
    setHasBiometric(false);
    setBiometricCredentialId(null);
    
    if (auth.currentUser) {
      try {
        await setSecuritySettings(auth.currentUser.uid, {
          pinHash: deleteField()
        });
      } catch (e) {
        console.error('Failed to clear PIN from cloud', e);
      }
    }
  };

  const handleForgotPin = async () => {
    if (!auth.currentUser) {
      alert('無法取得登入資訊，請重新整理頁面。');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      
      await setSecuritySettings(auth.currentUser.uid, {
        pinHash: deleteField()
      });

      localStorage.removeItem('pinHash');
      localStorage.removeItem('lockScope');
      
      alert('已成功清除 PIN 碼，請重新設定。');
      setIsPinSetupOpen(true);
    } catch (e) {
      console.error('Failed to reset PIN', e);
      alert('驗證失敗，無法重設密碼');
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
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">防窺模式預設等級</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <EyeOff className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <div className="font-medium">預設遮擋程度</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">每次開啟程式時的防窺狀態</div>
              </div>
            </div>
            <select 
              value={defaultPrivacyLevel}
              onChange={(e) => handlePrivacyLevelChange(Number(e.target.value))}
              className="bg-zinc-100 dark:bg-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>👀 顯示全部</option>
              <option value={1}>🫣 隱藏預算</option>
              <option value={2}>😎 隱藏預算與收支</option>
              <option value={3}>🙈 隱藏所有金額</option>
            </select>
          </div>
        </div>
      </section>

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
          <section className="space-y-4 pt-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">PIN 碼管理</h2>
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
              
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors" onClick={handleForgotPin}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Key className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">重設 PIN 碼</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">忘記密碼時，可透過 Google 驗證重設</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors" onClick={handleDisablePinClick}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-red-600 dark:text-red-400">清除安全鎖設定</div>
                    <div className="text-sm text-red-500/80 dark:text-red-400/80">移除 PIN 碼並關閉所有安全鎖</div>
                  </div>
                </div>
              </div>

            </div>
          </section>
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

      <PinVerifyDialog
        isOpen={isPinVerifyOpen}
        onClose={() => setIsPinVerifyOpen(false)}
        onSuccess={handleDisablePinConfirm}
        title="清除安全設定"
        description="請輸入 PIN 碼以確認您要清除所有安全設定。"
      />
    </div>
  );
}
