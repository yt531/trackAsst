'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import UnlockScreen from './UnlockScreen';
import { deriveKey } from '@/lib/crypto'; // We can use this to verify PIN later

// Default sensitive paths if not global
const SENSITIVE_PATHS = ['/settings', '/settings/security'];

type LockScope = 'global' | 'sensitive' | 'none';

interface LockContextType {
  isLocked: boolean;
  lockScope: LockScope;
  setLockScope: (scope: LockScope) => void;
  idleTimeout: number;
  setIdleTimeout: (ms: number) => void;
  hasPin: boolean;
  setHasPin: (val: boolean) => void;
  hasBiometric: boolean;
  setHasBiometric: (val: boolean) => void;
  biometricCredentialId: string | null;
  setBiometricCredentialId: (id: string | null) => void;
  lockApp: () => void;
  unlockApp: (pin?: string) => Promise<boolean>;
  validatePin: (pin: string) => Promise<boolean>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  
  // Settings
  const [lockScope, setLockScope] = useState<LockScope>('none');
  const [idleTimeout, setIdleTimeout] = useState<number>(0);
  const [hasPin, setHasPin] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  
  // Active State
  const [isLocked, setIsLocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const pathname = usePathname();

  // Load settings from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const scope = localStorage.getItem('lockScope') as LockScope;
      if (scope) setLockScope(scope);

      const timeout = localStorage.getItem('idleTimeout');
      if (timeout) setIdleTimeout(parseInt(timeout, 10));

      const pinHash = localStorage.getItem('pinHash');
      if (pinHash) setHasPin(true);

      const bio = localStorage.getItem('biometricCredentialId');
      if (bio) {
        setHasBiometric(true);
        setBiometricCredentialId(bio);
      }

      // Initial lock check
      if (pinHash && scope === 'global') {
        setIsLocked(true);
      }
    } catch (e) {
      console.error('Failed to load lock settings', e);
    }
  }, []);

  // Sync settings to localStorage
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('lockScope', lockScope);
    localStorage.setItem('idleTimeout', idleTimeout.toString());
    if (biometricCredentialId) {
      localStorage.setItem('biometricCredentialId', biometricCredentialId);
    } else {
      localStorage.removeItem('biometricCredentialId');
    }
  }, [lockScope, idleTimeout, biometricCredentialId, isMounted]);

  // Route change lock check for sensitive paths
  useEffect(() => {
    if (!isMounted || !hasPin) return;
    if (lockScope === 'sensitive' && !isLocked) {
      if (SENSITIVE_PATHS.some(p => pathname.startsWith(p))) {
        setIsLocked(true);
      }
    }
  }, [pathname, lockScope, isLocked, isMounted, hasPin]);

  // Idle timeout hook
  useIdleTimeout({
    timeoutMs: idleTimeout,
    enabled: hasPin && lockScope !== 'none' && !isLocked,
    onIdle: () => {
      // Only lock if we are globally locking, OR if we are on a sensitive path
      if (lockScope === 'global' || (lockScope === 'sensitive' && SENSITIVE_PATHS.some(p => pathname.startsWith(p)))) {
        setIsLocked(true);
      }
    }
  });

  const validatePin = async (pin: string): Promise<boolean> => {
    try {
      const storedSaltAndHash = localStorage.getItem('pinHash');
      if (!storedSaltAndHash) return false;
      
      const { saltBase64, hashBase64 } = JSON.parse(storedSaltAndHash);
      
      // Simple verification: try deriving key with same salt
      // In a real app we might hash it properly. Here we just use deriveKey to get raw bytes and compare
      const salt = new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
      const key = await deriveKey(pin, salt);
      const rawKey = await window.crypto.subtle.exportKey('raw', key);
      
      const derivedHashBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      return derivedHashBase64 === hashBase64;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const unlockApp = async (pin?: string): Promise<boolean> => {
    setUnlockError('');
    if (pin) {
      const isValid = await validatePin(pin);
      if (isValid) {
        setIsLocked(false);
        return true;
      } else {
        setUnlockError('PIN 碼不正確');
        return false;
      }
    } else {
      // Biometric unlock bypasses PIN check here since it already validated with platform
      setIsLocked(false);
      return true;
    }
  };

  const lockApp = () => setIsLocked(true);

  if (!isMounted) return null; // Avoid hydration mismatch

  return (
    <LockContext.Provider
      value={{
        isLocked,
        lockScope,
        setLockScope,
        idleTimeout,
        setIdleTimeout,
        hasPin,
        setHasPin,
        hasBiometric,
        setHasBiometric,
        biometricCredentialId,
        setBiometricCredentialId,
        lockApp,
        unlockApp,
        validatePin
      }}
    >
      {/* If locked, render nothing else but the unlock screen to defer fetching */}
      {isLocked ? (
        <UnlockScreen
          onUnlock={unlockApp}
          hasBiometric={hasBiometric}
          biometricCredentialId={biometricCredentialId || undefined}
          error={unlockError}
        />
      ) : (
        children
      )}
    </LockContext.Provider>
  );
}

export function useLock() {
  const context = useContext(LockContext);
  if (context === undefined) {
    throw new Error('useLock must be used within a LockProvider');
  }
  return context;
}
