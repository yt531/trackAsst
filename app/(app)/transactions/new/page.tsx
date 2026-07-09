'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentMethod, Category, Invoice, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';

function TransactionForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');
  const editId = searchParams.get('editId');

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [notes, setNotes] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoadingInitial(true);

    try {
      // Load Payment Methods
      const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
      const pms = pmSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(pms);

      // Load Custom Categories
      const catSnapshot = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      const allCats = [...DEFAULT_CATEGORIES as Category[], ...customCats];
      setCategories(allCats);

      let defaultPmId = pms.find(p => p.isDefault)?.id || (pms.length > 0 ? pms[0].id : '');
      
      if (editId) {
        // Load existing transaction for editing
        const txDoc = await getDoc(doc(db, 'users', user.uid, 'transactions', editId));
        if (txDoc.exists()) {
          const txData = txDoc.data() as Transaction;
          setType(txData.type);
          setAmount(txData.amount.toString());
          setCurrency(txData.currency || 'TWD');
          setExchangeRate(txData.exchangeRate?.toString() || '1');
          setCategoryId(txData.categoryId);
          setPaymentMethodId(txData.paymentMethodId);
          setDate(format(new Date(txData.date), "yyyy-MM-dd'T'HH:mm"));
          setNotes(txData.notes || '');
        }
      } else {
        // Set defaults for new transaction
        setCategoryId(allCats[0].id);
        setPaymentMethodId(defaultPmId || 'unset');

        // Load Invoice if provided
        if (invoiceId) {
          const invDoc = await getDoc(doc(db, 'users', user.uid, 'invoices', invoiceId));
          if (invDoc.exists()) {
            const invData = invDoc.data() as Invoice;
            setLinkedInvoice(invData);
            setAmount(invData.totalAmount.toString());
            setDate(format(new Date(invData.date), "yyyy-MM-dd'T'HH:mm"));
            const itemsNotes = invData.items?.map(i => `${i.description} x${i.quantity}`).join(', ');
            setNotes(`發票 ${invData.id}${itemsNotes ? `\n${itemsNotes}` : ''}`);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false);
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

      const txData = {
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
        updatedAt: Date.now(),
      };

      if (editId) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editId), txData);
      } else {
        const newTxData = {
          ...txData,
          invoiceId: invoiceId || null,
          createdAt: Date.now(),
        };
        await addDoc(collection(db, 'users', user.uid, 'transactions'), newTxData);

        if (invoiceId) {
          await updateDoc(doc(db, 'users', user.uid, 'invoices', invoiceId), {
            isLinkedToTransaction: true
          });
        }
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

  if (loadingInitial) {
    return <div className="p-8 text-center text-sm text-zinc-500">載入中...</div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{editId ? '修改交易' : '新增交易'}</h1>
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
              <option value="unset">未設定支付方式</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium">日期</label>
          <DatePicker
            type="datetime-local"
            required
            value={date}
            onChange={(val) => setDate(val)}
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
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '儲存中...' : (editId ? '儲存修改' : '儲存交易')}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500">載入表單中...</div>}>
      <TransactionForm />
    </Suspense>
  );
}
