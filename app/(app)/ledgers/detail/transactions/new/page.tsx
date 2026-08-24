'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category, LedgerMember, TransactionSplit, Tag } from '@/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Search, X, Users, User, Info } from 'lucide-react';
import { getLedgerMembers, getLedgerCategories, getLedgerTags, getFundCollections } from '@/lib/ledger';
import type { FundCollection } from '@/types';
import { createTransaction } from '@/lib/transactions';

function SharedTransactionForm() {
  const { user } = useAuth();
  const { activeLedgerId, activeLedger } = useLedger();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [settledTransactionId, setSettledTransactionId] = useState<string | null>(null);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);

  // Collections Logic
  const [collections, setCollections] = useState<FundCollection[]>([]);
  const [collectionId, setCollectionId] = useState<string>('');
  const [isFundContribution, setIsFundContribution] = useState(true);

  // Tags Logic
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Split Logic
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [payerId, setPayerId] = useState<string>('');
  const [splitWithIds, setSplitWithIds] = useState<string[]>([]);
  const [isSubmitOnBehalf, setIsSubmitOnBehalf] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (user && activeLedgerId) {
      loadData();
    } else if (!activeLedgerId) {
      router.push('/transactions/new');
    }
  }, [user, activeLedgerId]);

  useEffect(() => {
    // Check for settlement auto-fill
    const settleId = searchParams.get('settleReimbursement');
    if (settleId) {
      setSettledTransactionId(settleId);
      const settleAmount = searchParams.get('amount');
      const settleDate = searchParams.get('date'); // Original date for notes
      const settleDetails = searchParams.get('details');
      
      if (settleAmount) setAmount(settleAmount);
      if (settleDetails && settleDate) {
        setDetails(`代墊核銷：${settleDetails}`);
        setNotes(`[代墊核銷] 原日期: ${format(new Date(Number(settleDate)), 'yyyy-MM-dd')}, 項目: ${settleDetails}, 金額: ${settleAmount}`);
      }
    }
  }, [searchParams]);

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

      // Load Collections for Income
      if (activeLedger?.mode === 'shared_fund') {
        const fetchedCollections = await getFundCollections(activeLedgerId);
        const activeCollections = fetchedCollections.filter(c => c.status === 'active');
        setCollections(activeCollections);
        if (activeCollections.length > 0) {
          setCollectionId(activeCollections[0].id);
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
    if (!user || !activeLedgerId || !amount || !payerId) return;
    
    // Validations
    if (!(type === 'income' && activeLedger?.mode === 'shared_fund' && isFundContribution) && !categoryId) {
      alert('請選擇分類');
      return;
    }
    if (activeLedger?.mode === 'shared_fund' && type === 'income' && isFundContribution && !collectionId) {
      alert('請選擇要繳交的期數');
      return;
    }
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
        paymentMethodId: 'cash', // Shared ledgers may not use personal PMs
        date: new Date(date).getTime(),
        details,
        notes,
        tagIds: selectedTags.length > 0 ? selectedTags : undefined,
        splits,
        payerId: (activeLedger?.mode === 'shared_fund' && isSubmitOnBehalf) ? payerId : user.uid,
        isAdvancePayment: isAdvancePayment && activeLedger?.mode === 'shared_fund',
        advancePaymentStatus: (isAdvancePayment && activeLedger?.mode === 'shared_fund') ? 'unsettled' : undefined,
        collectionId: (type === 'income' && activeLedger?.mode === 'shared_fund' && isFundContribution) ? collectionId : undefined,
        approvalStatus: (type === 'income' && activeLedger?.mode === 'shared_fund' && isFundContribution) ? 'pending' : undefined,
        categoryId: (type === 'income' && activeLedger?.mode === 'shared_fund' && isFundContribution) 
          ? (categories.find(c => c.type === 'income')?.id || 'default_income') 
          : categoryId,
      }, true);

      // If we are settling an advance payment, we should also update the original transaction
      if (settledTransactionId) {
        // Need to update the original advance payment to 'settled'
        const txRef = doc(db, 'ledgers', activeLedgerId, 'transactions', settledTransactionId);
        await updateDoc(txRef, {
          advancePaymentStatus: 'settled',
          settledTransactionId: 'settled_by_new_tx' // Optionally we could get the newly created tx ID, but createTransaction doesn't return it currently.
        });
      }

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
          
          {/* Type Toggle */}
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                type === 'expense'
                  ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300'
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
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
            >
              收入 (繳款)
            </button>
          </div>

          {/* Fund Contribution Toggle and Selector for Income */}
          {activeLedger?.mode === 'shared_fund' && type === 'income' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10">
                <input 
                  type="checkbox" 
                  id="isFundContribution"
                  checked={isFundContribution}
                  onChange={(e) => setIsFundContribution(e.target.checked)}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isFundContribution" className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  這是一筆公積金繳款（將進入成員繳費進度）
                </label>
              </div>

              {isFundContribution && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-900/5">
                  <label className="mb-2 block text-sm font-bold text-blue-900 dark:text-blue-200">
                    這是繳交哪一期的公積金？
                  </label>
              {collections.length > 0 ? (
                <select
                  required
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="w-full rounded-lg border border-blue-300 bg-white p-3 text-sm text-blue-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-100"
                >
                  <option value="" disabled>請選擇收款期數...</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.title} (應繳: {c.targetAmount})</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  目前沒有開放的收款期數，請管理員先發起收款。
                </div>
              )}
                </div>
              )}
            </div>
          )}

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
            {!(type === 'income' && activeLedger?.mode === 'shared_fund' && isFundContribution) && (
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
            )}
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

          {/* Advance Payment Field */}
          {activeLedger?.mode === 'shared_fund' && type === 'expense' && !settledTransactionId && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
              <input 
                type="checkbox" 
                id="isAdvancePayment"
                checked={isAdvancePayment}
                onChange={(e) => setIsAdvancePayment(e.target.checked)}
                className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="isAdvancePayment" className="text-sm font-medium text-amber-900 dark:text-amber-200">
                這是代墊款（暫不扣除公積金，將列入待撥款）
              </label>
            </div>
          )}

          {/* Submit on Behalf Field (Shared Fund) */}
          {activeLedger?.mode === 'shared_fund' && (
            <div className="space-y-3 p-4 rounded-xl border border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isSubmitOnBehalf"
                  checked={isSubmitOnBehalf}
                  onChange={(e) => {
                    setIsSubmitOnBehalf(e.target.checked);
                    if (!e.target.checked && user) setPayerId(user.uid);
                  }}
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isSubmitOnBehalf" className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  代為送出審核
                </label>
              </div>
              {isSubmitOnBehalf && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900 dark:text-blue-200">實際付款人</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full rounded-lg border border-blue-200 bg-white p-2.5 text-sm dark:border-blue-800 dark:bg-zinc-900"
                  >
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.nickname || `User ${m.userId.slice(0,4)}`} {m.userId === user?.uid ? '(我)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium">備註</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field-sizing-content w-full min-h-[60px] rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="新增備註..."
            />
          </div>

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
