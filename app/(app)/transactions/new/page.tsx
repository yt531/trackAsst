'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentMethod, Category, Invoice, Transaction, Tag } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Search, X, Plus } from 'lucide-react';

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [tags, setTags] = useState<Tag[]>([]);
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
      const pms = pmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      
      const hasCash = pms.find(m => m.id === 'cash');
      const hasUnset = pms.find(m => m.id === 'unset');
      
      if (!hasCash) {
        pms.push({ id: 'cash', type: 'cash', name: '現金', isSystem: true, order: -2 } as PaymentMethod);
      }
      if (!hasUnset) {
        pms.push({ id: 'unset', type: 'unset', name: '未設定支付方式', isSystem: true, order: -1 } as PaymentMethod);
      }
      
      pms.sort((a, b) => (a.order || 0) - (b.order || 0));
      setPaymentMethods(pms);

      // Load Custom Categories
      const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      const allCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
      setCategories(allCats);

      // Load Tags
      const tagSnapshot = await getDocs(collection(db, 'users', user.uid, 'tags'));
      let userTags = tagSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
      
      userTags.sort((a, b) => {
        const orderA = a.order ?? a.createdAt;
        const orderB = b.order ?? b.createdAt;
        return orderA - orderB;
      });
      
      setTags(userTags);

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
          if (txData.tagIds) {
            setSelectedTags(txData.tagIds);
          }
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
        tagIds: selectedTags,
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
    return <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>;
  }

  const filteredTags = tags.filter((tag) => 
    (tag.name || '').toLowerCase().includes((tagSearchQuery || '').toLowerCase())
  );

  const filteredCategories = categories.filter(c => c.type === type).filter((cat) =>
    (cat.name || '').toLowerCase().includes((categorySearchQuery || '').toLowerCase())
  );

  const filteredPaymentMethods = paymentMethods.filter((pm) =>
    (pm.name || '').toLowerCase().includes((paymentSearchQuery || '').toLowerCase())
  );

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

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              type === 'expense'
                ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'
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
                : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'
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
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {amount && exchangeRate ? `≈ ${(parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2)} TWD` : ''}
            </p>
          </div>
        )}

        {/* Category & Payment Method */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">分類</label>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white p-3 text-sm text-left dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className={!categoryId ? "text-zinc-500 dark:text-zinc-400" : "truncate"}>
                {categoryId ? categories.find(c => c.id === categoryId)?.name || '未知分類' : '搜尋分類...'}
              </span>
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">支付方式</label>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white p-3 text-sm text-left dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className={!paymentMethodId ? "text-zinc-500 dark:text-zinc-400" : "truncate"}>
                {paymentMethodId ? paymentMethods.find(p => p.id === paymentMethodId)?.name || '未知支付方式' : '搜尋支付方式...'}
              </span>
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>
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

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm font-medium">標籤</label>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tagId) => {
              const tag = tags.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTags(selectedTags.filter(id => id !== tag.id))}
                    className="ml-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setIsTagModalOpen(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <Plus className="h-3 w-3" />
              新增標籤
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field-sizing-content w-full min-h-[80px] rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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

      {/* Tags Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇標籤</h2>
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋標籤..."
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {tags.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                  目前沒有任何標籤。<br/>請至設定頁面新增標籤。
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">找不到符合的標籤。</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                          } else {
                            setSelectedTags([...selectedTags, tag.id]);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{tag.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇分類</h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋分類..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {filteredCategories.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">找不到符合的分類。</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredCategories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(cat.id);
                          setIsCategoryModalOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{cat.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇支付方式</h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋支付方式..."
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {filteredPaymentMethods.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">找不到符合的支付方式。</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredPaymentMethods.map((pm) => {
                    const isSelected = paymentMethodId === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethodId(pm.id);
                          setIsPaymentModalOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{pm.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入表單中...</div>}>
      <TransactionForm />
    </Suspense>
  );
}
