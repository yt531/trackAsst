'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { Scale, CheckCircle2, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Transaction } from '@/types';
import { calculateBalances, calculateSettlements, UserBalance, SettlementPlan } from '@/lib/settlements';
import { createTransaction } from '@/lib/transactions';
import { useRouter } from 'next/navigation';

export default function LedgerBalancesPage() {
  const { activeLedger, activeLedgerId } = useLedger();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [plans, setPlans] = useState<SettlementPlan[]>([]);
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!activeLedgerId) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'ledgers', activeLedgerId, 'transactions'));
        const snap = await getDocs(q);
        const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        
        const balancesRecord = calculateBalances(txs);
        const calculatedPlans = calculateSettlements(balancesRecord);
        
        setBalances(Object.values(balancesRecord));
        setPlans(calculatedPlans);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [activeLedgerId]);

  const handleSettle = async (plan: SettlementPlan) => {
    if (!user || !activeLedger) return;
    if (!confirm(`確定要記錄這筆還款嗎？\n金額: ${plan.amount}`)) return;

    setIsSettling(true);
    try {
      // Create a settlement transaction
      // fromUser paid, and it entirely benefits toUser
      await createTransaction(user.uid, {
        userId: plan.fromUser,
        ledgerId: activeLedger.id,
        type: 'settlement',
        amount: plan.amount,
        baseAmount: plan.amount,
        currency: activeLedger.currency,
        exchangeRate: 1,
        categoryId: 'settlement',
        paymentMethodId: 'cash',
        date: Date.now(),
        details: '結清帳款',
        notes: '',
        splits: [{ userId: plan.toUser, paidAmount: 0, owedAmount: plan.amount }]
      }, true);

      alert('結清紀錄已新增！');
      // Reload the page to refresh balances
      window.location.reload();
    } catch (err) {
      console.error('Error settling up', err);
      alert('結清失敗');
    } finally {
      setIsSettling(false);
    }
  };

  if (activeLedger?.mode === 'shared_fund') {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800/50 mt-4">
        <div className="mb-3 rounded-full bg-zinc-200 p-4 dark:bg-zinc-700">
          <Scale className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
        </div>
        <h3 className="text-lg font-bold">公積金模式</h3>
        <p className="max-w-sm text-sm text-zinc-500">
          本帳本為公積金模式，僅記錄共同支出，不計算個人間的欠款與結算。
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-zinc-500">計算中...</div>;
  }

  const myBalance = balances.find(b => b.userId === user?.uid)?.netBalance || 0;

  return (
    <div className="space-y-6 pb-20">
      {/* My Status Card */}
      <div className={`rounded-2xl p-6 text-white shadow-sm ${
        myBalance > 0 ? 'bg-emerald-600' : myBalance < 0 ? 'bg-rose-600' : 'bg-zinc-600'
      }`}>
        <h3 className="text-sm font-medium opacity-90 mb-1">您的目前狀態</h3>
        <div className="text-3xl font-bold">
          {myBalance > 0 ? (
            <>別人欠您 ${Math.abs(myBalance)}</>
          ) : myBalance < 0 ? (
            <>您總共欠款 ${Math.abs(myBalance)}</>
          ) : (
            <>無欠款，一身輕！</>
          )}
        </div>
      </div>

      {/* Suggested Settlements */}
      <section>
        <h3 className="text-lg font-bold mb-3">建議結算方案</h3>
        {plans.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
            <p className="font-medium text-zinc-900 dark:text-zinc-100">目前帳目已結清</p>
            <p className="text-sm text-zinc-500">群組內沒有任何欠款需要處理。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan, idx) => {
              const isMeFrom = plan.fromUser === user?.uid;
              const isMeTo = plan.toUser === user?.uid;
              const involved = isMeFrom || isMeTo;

              return (
                <div key={idx} className={`flex items-center justify-between rounded-xl border p-4 shadow-sm ${
                  involved 
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10' 
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {isMeFrom ? '您' : `使用者 ${plan.fromUser.slice(0,4)}`}
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {isMeTo ? '您' : `使用者 ${plan.toUser.slice(0,4)}`}
                    </div>
                    <div className="ml-2 font-bold text-lg text-zinc-900 dark:text-zinc-100">
                      ${plan.amount}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSettle(plan)}
                    disabled={isSettling}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    結清
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* All Members Balances */}
      <section>
        <h3 className="text-lg font-bold mb-3">群組成員餘額</h3>
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
          {balances.map(b => {
            const isMe = b.userId === user?.uid;
            return (
              <div key={b.userId} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${
                    isMe ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}>
                    {isMe ? '我' : '友'}
                  </div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {isMe ? '您 (You)' : `使用者 ${b.userId.slice(0,4)}`}
                  </span>
                </div>
                <div className={`font-bold ${
                  b.netBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : b.netBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'
                }`}>
                  {b.netBalance > 0 ? '+' : ''}{b.netBalance}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
