'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { Transaction, Category, PaymentMethod } from '@/types';
import Link from 'next/link';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load Categories
      const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      const allCats = [...DEFAULT_CATEGORIES as Category[], ...customCats];
      const catMap = allCats.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {} as Record<string, Category>);
      setCategories(catMap);

      // Load Payment Methods
      const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
      const pmMap = pmSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = { id: doc.id, ...doc.data() } as PaymentMethod;
        return acc;
      }, {} as Record<string, PaymentMethod>);
      setPaymentMethods(pmMap);

      // Load Transactions
      const q = query(
        collection(db, 'users', user.uid, 'transactions'),
        orderBy('date', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Group by date
  const grouped = transactions.reduce((acc, tx) => {
    const d = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[d]) acc[d] = [];
    acc[d].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your recent financial activity.
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </Link>
      </header>

      {loading ? (
        <div className="text-center text-sm text-zinc-500 py-8">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 mb-4">No transactions found.</p>
          <Link href="/transactions/new" className="text-blue-600 hover:underline">Add your first transaction</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([dateStr, txs]) => (
            <div key={dateStr}>
              <h3 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {format(new Date(dateStr), 'MMMM d, yyyy')}
              </h3>
              <div className="space-y-2">
                {txs.map((tx) => {
                  const cat = categories[tx.categoryId];
                  const pm = paymentMethods[tx.paymentMethodId];
                  const isExpense = tx.type === 'expense';
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 group">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isExpense ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                          {isExpense ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-medium">{cat?.name || 'Unknown Category'}</div>
                          <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                            <span>{pm?.name || 'Unknown Payment'}</span>
                            {tx.invoiceId && <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-[10px]">Invoice</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`text-right font-medium ${
                          isExpense ? 'text-zinc-900 dark:text-zinc-100' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {isExpense ? '-' : '+'} {tx.amount.toLocaleString()} {tx.currency}
                          {tx.currency !== 'TWD' && (
                             <div className="text-[10px] text-zinc-500">
                               (≈ {tx.baseAmount.toLocaleString()} TWD)
                             </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
