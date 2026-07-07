'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentMethod, Category, Invoice } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

function NewTransactionForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    // Load Payment Methods
    const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
    const pms = pmSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
    setPaymentMethods(pms);
    if (pms.length > 0) {
      setPaymentMethodId(pms.find(p => p.isDefault)?.id || pms[0].id);
    }

    // Load Custom Categories
    const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
    const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    setCategories([...DEFAULT_CATEGORIES as Category[], ...customCats]);

    // Load Invoice if provided
    if (invoiceId) {
      const invDoc = await getDoc(doc(db, 'users', user.uid, 'invoices', invoiceId));
      if (invDoc.exists()) {
        const invData = invDoc.data() as Invoice;
        setLinkedInvoice(invData);
        setAmount(invData.totalAmount.toString());
        setDate(new Date(invData.date).toISOString().split('T')[0]);
        const itemsNotes = invData.items?.map(i => `${i.description} x${i.quantity}`).join(', ');
        setNotes(`發票 ${invData.id}${itemsNotes ? `\n${itemsNotes}` : ''}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !categoryId || !paymentMethodId) return;
    setIsSubmitting(true);

    try {
      const numAmount = parseFloat(amount);
      const numRate = parseFloat(exchangeRate);
      const baseAmount = numAmount * numRate;

      const txDoc = {
        userId: user.uid,
        type,
        amount: numAmount,
        baseAmount,
        currency,
        exchangeRate: numRate,
        categoryId,
        paymentMethodId,
        date: new Date(date).getTime(),
        notes,
        invoiceId: invoiceId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await addDoc(collection(db, 'users', user.uid, 'transactions'), txDoc);

      if (invoiceId) {
        await updateDoc(doc(db, 'users', user.uid, 'invoices', invoiceId), {
          isLinkedToTransaction: true
        });
      }

      router.push('/transactions');
      router.refresh();
    } catch (error) {
      console.error('Error saving transaction', error);
      alert('儲存交易失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">新增交易</h1>
      </header>

      {linkedInvoice && (
        <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            已連結發票：{linkedInvoice.id}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              type === 'expense'
                ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              type === 'income'
                ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            收入
          </button>
        </div>

        {/* Amount & Currency */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">金額</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-lg font-bold dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="0.00"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-sm font-medium">幣別</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 h-[52px]"
            >
              <option value="TWD">TWD</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {currency !== 'TWD' && (
          <div>
            <label className="mb-1 block text-sm font-medium">匯率 (轉為基準貨幣)</label>
            <input
              type="number"
              step="0.000001"
              required
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="mt-1 text-xs text-zinc-500">
              {amount && exchangeRate ? `≈ ${(parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2)} TWD` : ''}
            </p>
          </div>
        )}

        {/* Category & Payment Method */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">分類</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="" disabled>選擇分類</option>
              {categories.filter(c => c.type === type).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">支付方式</label>
            <select
              required
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="" disabled>選擇支付方式</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
            {paymentMethods.length === 0 && (
              <p className="mt-1 text-xs text-red-500">請在設定中新增支付方式。</p>
            )}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium">日期</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="新增一些詳細資訊..."
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || paymentMethods.length === 0}
          className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '儲存中...' : '儲存交易'}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>載入表單中...</div>}>
      <NewTransactionForm />
    </Suspense>
  );
}
