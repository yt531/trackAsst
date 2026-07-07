'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { Invoice } from '@/types';
import Link from 'next/link';
import { ScanLine, Receipt, Settings2, Cloud, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cloud' | 'paper'>('cloud');

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  const loadInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'invoices'),
        orderBy('date', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => inv.type === activeTab);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice Passbook</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your electronic invoices.
          </p>
        </div>
        <Link
          href="/invoices/scan"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">Scan</span>
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          onClick={() => setActiveTab('cloud')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'cloud'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Cloud className="h-4 w-4" />
          Cloud Invoices
        </button>
        <button
          onClick={() => setActiveTab('paper')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'paper'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          Paper (Scanned)
        </button>
      </div>

      {activeTab === 'cloud' && (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <Cloud className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-lg font-medium">Coming Soon</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Integration with the Ministry of Finance API for Cloud Invoices is planned for a future update.
          </p>
        </div>
      )}

      {activeTab === 'paper' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-zinc-500 py-8">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
              <Receipt className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <h3 className="text-lg font-medium">No scanned invoices</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Scan your paper electronic invoices to keep track of them here.
              </p>
              <Link
                href="/invoices/scan"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Scan an invoice now &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-zinc-500">{format(new Date(inv.date), 'MMM d, yyyy')}</div>
                      <div className="font-mono text-sm font-medium mt-1">{inv.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-600 dark:text-blue-400">NT$ {inv.totalAmount}</div>
                      {inv.isLinkedToTransaction ? (
                        <span className="text-[10px] uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Recorded</span>
                      ) : (
                        <Link href={`/transactions/new?invoiceId=${inv.id}`} className="text-[10px] uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full">Record Now</Link>
                      )}
                    </div>
                  </div>
                  {inv.items && inv.items.length > 0 && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <div className="text-xs text-zinc-500 truncate">
                        {inv.items.map(i => i.description).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
