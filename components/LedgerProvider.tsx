'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, getDoc, doc } from 'firebase/firestore';
import { Ledger, LedgerMember } from '@/types';
import { LEDGER_COLLECTIONS } from '@/lib/ledger';

interface LedgerContextType {
  activeLedgerId: string | null;
  activeLedger: Ledger | null;
  setActiveLedgerId: (id: string | null) => void;
  ledgers: Ledger[];
  isLoading: boolean;
  refreshLedgers: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextType>({
  activeLedgerId: null,
  activeLedger: null,
  setActiveLedgerId: () => {},
  ledgers: [],
  isLoading: true,
  refreshLedgers: async () => {},
});

export const useLedger = () => useContext(LedgerContext);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // Retrieve saved active ledger ID from local storage if available
  const [activeLedgerId, setActiveLedgerIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('trackAsst_activeLedgerId') || null;
    }
    return null;
  });
  
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setActiveLedgerId = (id: string | null) => {
    setActiveLedgerIdState(id);
    if (id) {
      localStorage.setItem('trackAsst_activeLedgerId', id);
    } else {
      localStorage.removeItem('trackAsst_activeLedgerId');
    }
  };

  const fetchLedgers = async () => {
    if (!user) {
      setLedgers([]);
      setIsLoading(false);
      return;
    }

    try {
      // Use the user's personal ledgerMemberships subcollection to avoid collectionGroup permission issues
      const userMembershipsRef = collection(db, 'users', user.uid, 'ledgerMemberships');
      
      let membersSnap;
      try {
        membersSnap = await getDocs(userMembershipsRef);
      } catch (err) {
        console.error('Permission error on user ledgerMemberships:', err);
        throw err;
      }
      
      const ledgerPromises = membersSnap.docs.map(async (memberDoc) => {
        const data = memberDoc.data();
        const ledgerId = data.ledgerId || memberDoc.id;
        try {
          const ledgerDoc = await getDoc(doc(db, LEDGER_COLLECTIONS.LEDGERS, ledgerId));
          return ledgerDoc.exists() ? (ledgerDoc.data() as Ledger) : null;
        } catch (err) {
          console.error(`Permission error on getDoc(ledger) for ${ledgerId}:`, err);
          return null;
        }
      });

      const fetchedLedgers = (await Promise.all(ledgerPromises)).filter((l): l is Ledger => l !== null);
      
      setLedgers(fetchedLedgers);
      
      // If the saved active ledger is not in the list anymore, reset it
      if (activeLedgerId && !fetchedLedgers.find(l => l.id === activeLedgerId)) {
        setActiveLedgerId(null);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, [user]);

  const activeLedger = ledgers.find(l => l.id === activeLedgerId) || null;

  return (
    <LedgerContext.Provider value={{
      activeLedgerId,
      activeLedger,
      setActiveLedgerId,
      ledgers,
      isLoading,
      refreshLedgers: fetchLedgers
    }}>
      {children}
    </LedgerContext.Provider>
  );
}
