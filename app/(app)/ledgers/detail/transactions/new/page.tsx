'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { useRouter } from 'next/navigation';
import { Category, LedgerMember, TransactionSplit, Tag } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Search, X, Users, User } from 'lucide-react';
import { getLedgerMembers, getLedgerCategories, getLedgerTags } from '@/lib/ledger';
import { createTransaction } from '@/lib/transactions';

function SharedTransactionForm() {
  const { user } = useAuth();
  const { activeLedgerId, activeLedger } = useLedger();
  const router = useRouter();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);

  // Tags Logic
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Split Logic
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [payerId, setPayerId] = useState<string>('');
  const [splitWithIds, setSplitWithIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (user && activeLedgerId) {
      loadData();
    } else if (!activeLedgerId) {
      router.push('/transactions/new');
    }
  }, [user, activeLedgerId]);

  const loadData = async () => {
    if (!user || !activeLedgerId) return;
    setLoadingInitial(true);
    try {
      // Load Members
      const ledgerMembers = await getLedgerMembers(activeLedgerId);
      setMembers(ledgerMembers);
      
      // Default payer is current user
      setPayerId(user.uid);
      // Default split with everyone
      setSplitWithIds(ledgerMembers.map(m => m.userId));

      // Load Categories
      const fetchedCategories = await getLedgerCategories(activeLedgerId);
      if (fetchedCategories.length > 0) {
        setCategories(fetchedCategories);
      } else {
        setCategories(DEFAULT_CATEGORIES as Category[]);
      }
      setCategoryId(fetchedCategories[0]?.id || DEFAULT_CATEGORIES[0].id);

      // Load Tags
      const fetchedTags = await getLedgerTags(activeLedgerId);
      setTags(fetchedTags);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeLedgerId || !amount || !categoryId || !payerId) return;
    
    // Validate splits if split mode
    if (activeLedger?.mode === 'split' && splitWithIds.length === 0) {
      alert('請至少選擇一位分攤對象');
      return;
    }

    setIsSubmitting(true);
    try {
      const numAmount = parseFloat(amount);
      const baseAmount = numAmount; // Simplification

      let splits: TransactionSplit[] | undefined = undefined;

      if (activeLedger?.mode === 'split') {
        const splitAmount = numAmount / splitWithIds.length;
        splits = members.map(m => {
          const isPayer = m.userId === payerId;
          const isSplitter = splitWithIds.includes(m.userId);
          
          return {
            userId: m.userId,
            paidAmount: isPayer ? numAmount : 0,
            owedAmount: isSplitter ? splitAmount : 0,
          };
        }).filter(s => s.paidAmount > 0 || s.owedAmount > 0);
      }

      await createTransaction(user.uid, {
        userId: user.uid,
        ledgerId: activeLedgerId,
        type,
        amount: numAmount,
        baseAmount,
        currency: activeLedger?.currency || 'TWD',
        exchangeRate: 1,
        categoryId,
        paymentMethodId: 'cash', // Shared ledgers may not use personal PMs
        date: new Date(date).getTime(),
        details,
        notes,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
        splits,
      }, true);

      router.push(`/ledgers/detail?id=${activeLedgerId}`);
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

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">新增共享交易</h1>
        <p className="text-sm text-zinc-500">{activeLedger?.name}</p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount */}
          <div>
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

          {/* Details */}
          <div>
            <label className="mb-1 block text-sm font-medium">交易明細</label>
            <input
              type="text"
              required
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="例如：晚餐、水電費..."
            />
          </div>

          {/* Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">日期</label>
              <DatePicker
                type="datetime-local"
                required
                value={date}
                onChange={(val) => setDate(val)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">分類</label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white p-3 text-sm text-left dark:border-zinc-700 dark:bg-zinc-900"
              >
                <span className={!categoryId ? "text-zinc-500" : "truncate"}>
                  {categoryId ? categories.find(c => c.id === categoryId)?.name || '未知分類' : '選擇分類...'}
                </span>
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium">標籤</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
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
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-900/50 dark:text-blue-100'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Split Mode Fields */}
          {activeLedger?.mode === 'split' && (
            <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Users className="h-4 w-4" /> 分帳設定
              </h3>
              
              <div>
                <label className="mb-2 block text-sm font-medium">誰先付錢的？ (付款人)</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => setPayerId(m.userId)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        payerId === m.userId 
                          ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-900/50 dark:text-blue-100' 
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      {m.userId === user?.uid ? '我' : m.userId.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">要跟誰分攤？ (平均分攤)</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => {
                    const isSelected = splitWithIds.includes(m.userId);
                    return (
                      <button
                        key={`split_${m.userId}`}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSplitWithIds(splitWithIds.filter(id => id !== m.userId));
                          } else {
                            setSplitWithIds([...splitWithIds, m.userId]);
                          }
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isSelected 
                            ? 'border-purple-500 bg-purple-100 text-purple-700 dark:border-purple-400 dark:bg-purple-900/50 dark:text-purple-100' 
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        <User className="h-4 w-4" />
                        {m.userId === user?.uid ? '我' : m.userId.slice(0, 4)}
                      </button>
                    );
                  })}
                </div>
                {amount && splitWithIds.length > 0 && (
                  <p className="mt-2 text-sm text-zinc-500">
                    每人需分攤: {(parseFloat(amount) / splitWithIds.length).toFixed(2)} {activeLedger.currency}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '儲存中...' : '儲存共享交易'}
          </button>
        </form>
      </div>

      {/* Category Modal (Simplified) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇分類</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="rounded-full p-2 text-zinc-500"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-1">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setCategoryId(cat.id); setIsCategoryModalOpen(false); }}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="font-medium text-sm">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center">載入中...</div>}>
      <SharedTransactionForm />
    </Suspense>
  );
}
