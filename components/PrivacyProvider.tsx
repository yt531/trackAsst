'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUserSettings } from '@/lib/db';

interface PrivacyContextType {
  privacyLevel: number;
  setPrivacyLevel: (value: number) => void;
}

export const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyLevel, setPrivacyLevel] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setIsMounted(true);
    const cachedLevel = localStorage.getItem('cachedDefaultPrivacyLevel');
    if (cachedLevel !== null) {
      setPrivacyLevel(parseInt(cachedLevel, 10));
    }
  }, []);

  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then(settings => {
        const level = settings?.defaultPrivacyLevel ?? 0;
        setPrivacyLevel(level);
        localStorage.setItem('cachedDefaultPrivacyLevel', level.toString());
      });
    } else if (user === null) {
      // User logged out, clear cache
      localStorage.removeItem('cachedDefaultPrivacyLevel');
      setPrivacyLevel(0);
    }
  }, [user]);

  const setLevel = (value: number) => {
    setPrivacyLevel(value);
  };

  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <PrivacyContext.Provider value={{ privacyLevel, setPrivacyLevel: setLevel }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    return { privacyLevel: 0, setPrivacyLevel: () => {} };
  }
  return context;
}

export function PrivacyText({ type = 'all', text, className = '' }: { type?: 'budget' | 'summary' | 'all'; text: string | number; className?: string }) {
  const { privacyLevel } = usePrivacy();
  
  let shouldBlur = false;
  if (type === 'budget' && privacyLevel >= 1) shouldBlur = true;
  if (type === 'summary' && privacyLevel >= 2) shouldBlur = true;
  if (type === 'all' && privacyLevel >= 3) shouldBlur = true;
  
  if (shouldBlur) {
    return <span className={`filter blur-sm select-none opacity-80 ${className}`}>****</span>;
  }
  
  return <span className={className}>{text}</span>;
}
