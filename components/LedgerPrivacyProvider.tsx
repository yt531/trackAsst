'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUserSettings, setUserSettings } from '@/lib/db';

interface LedgerPrivacyContextType {
  ledgerPrivacyLevel: number;
  setLedgerPrivacyLevel: (value: number) => void;
}

const LedgerPrivacyContext = createContext<LedgerPrivacyContextType | undefined>(undefined);

export function LedgerPrivacyProvider({ children }: { children: ReactNode }) {
  const [ledgerPrivacyLevel, setLedgerPrivacyLevelState] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setIsMounted(true);
    const cachedLevel = localStorage.getItem('cachedLedgerPrivacyLevel');
    if (cachedLevel !== null) {
      setLedgerPrivacyLevelState(parseInt(cachedLevel, 10));
    }
  }, []);

  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then(settings => {
        const level = settings?.ledgerPrivacyLevel ?? 0;
        setLedgerPrivacyLevelState(level);
        localStorage.setItem('cachedLedgerPrivacyLevel', level.toString());
      });
    } else if (user === null) {
      // User logged out, clear cache
      localStorage.removeItem('cachedLedgerPrivacyLevel');
      setLedgerPrivacyLevelState(0);
    }
  }, [user]);

  const setLedgerPrivacyLevel = async (value: number) => {
    setLedgerPrivacyLevelState(value);
    localStorage.setItem('cachedLedgerPrivacyLevel', value.toString());
    if (user) {
      try {
        await setUserSettings(user.uid, { ledgerPrivacyLevel: value });
      } catch (e) {
        console.error('Failed to save ledger privacy level', e);
      }
    }
  };

  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <LedgerPrivacyContext.Provider value={{ ledgerPrivacyLevel, setLedgerPrivacyLevel }}>
      {children}
    </LedgerPrivacyContext.Provider>
  );
}

export function useLedgerPrivacy() {
  const context = useContext(LedgerPrivacyContext);
  if (context === undefined) {
    return { ledgerPrivacyLevel: 0, setLedgerPrivacyLevel: () => {} };
  }
  return context;
}

export function LedgerPrivacyText({ type = 'all', text, className = '' }: { type?: 'summary' | 'all'; text: string | number; className?: string }) {
  const { ledgerPrivacyLevel } = useLedgerPrivacy();
  
  // Options:
  // 0: 顯示全部
  // 1: 隱藏明細 (Hide all)
  // 2: 隱藏總收支 (Hide summary)
  // 3: 隱藏所有金額
  let shouldBlur = false;
  if (ledgerPrivacyLevel === 1 && type === 'all') shouldBlur = true;
  if (ledgerPrivacyLevel === 2 && type === 'summary') shouldBlur = true;
  if (ledgerPrivacyLevel === 3) shouldBlur = true;
  
  if (shouldBlur) {
    return <span className={`filter blur-sm select-none opacity-80 ${className}`}>****</span>;
  }
  
  return <span className={className}>{text}</span>;
}
