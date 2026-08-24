'use client';

import { Ledger, Transaction, LedgerMember, Category } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Settings2, Wallet, Users, CheckCircle2, AlertCircle, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { updateLedger } from '@/lib/ledger';

interface FundDashboardProps {
  ledger: Ledger;
  transactions: Transaction[];
  onSettleReimbursement: (tx: Transaction) => Promise<void>;
}

export function FundDashboard({ ledger, transactions, onSettleReimbursement }: FundDashboardProps) {
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(ledger.fundSettings?.budgetAmount?.toString() || '');
  const [memberTargetInput, setMemberTargetInput] = useState(ledger.fundSettings?.memberTargetAmount?.toString() || '');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const q = query(collection(db, 'ledgers', ledger.id, 'members'));
        const snap = await getDocs(q);
        const membersData = snap.docs.map(d => d.data() as LedgerMember);
        setMembers(membersData);
      } catch (err) {
        console.error('Failed to fetch members', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [ledger.id]);

  const {
    totalBalance,
    totalSpent,
    reimbursements,
    categoryData,
    memberStats
  } = useMemo(() => {
    let balance = 0;
    let spent = 0;
    const reimbursementsList: Transaction[] = [];
    const categoryTotals: Record<string, number> = {};
    const memberPayments: Record<string, number> = {};

    transactions.forEach(tx => {
      // 1. Calculate balance
      if (tx.type === 'income') {
        balance += tx.amount;
        memberPayments[tx.userId] = (memberPayments[tx.userId] || 0) + tx.amount;
      } else if (tx.type === 'expense') {
        // Is it a reimbursement/代墊?
        const isReimbursement = tx.paymentMethodId === 'reimbursement_pending' || tx.notes?.includes('代墊');
        
        if (isReimbursement) {
          reimbursementsList.push(tx);
          // Don't deduct from balance yet until it's settled.
        } else {
          balance -= tx.amount;
          spent += tx.amount;
          
          categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + tx.amount;
        }
      } else if (tx.type === 'settlement') {
        // Settlements deduct from balance (reimbursing a member)
        balance -= tx.amount;
      }
    });

    const catData = Object.keys(categoryTotals).map(catId => ({
      name: catId, 
      value: categoryTotals[catId]
    })).sort((a, b) => b.value - a.value);

    return {
      totalBalance: balance,
      totalSpent: spent,
      reimbursements: reimbursementsList,
      categoryData: catData,
      memberStats: memberPayments
    };
  }, [transactions]);

  const handleSaveSettings = async () => {
    try {
      await updateLedger(ledger.id, {
        fundSettings: {
          ...ledger.fundSettings,
          budgetAmount: Number(budgetInput) || 0,
          memberTargetAmount: Number(memberTargetInput) || 0,
          budgetPeriod: 'monthly'
        }
      });
      setIsEditingBudget(false);
      window.location.reload(); 
    } catch (err) {
      console.error('Failed to update ledger', err);
      alert('更新失敗');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">載入中...</div>;
  }

  const targetBudget = ledger.fundSettings?.budgetAmount || 0;
  const budgetPercentage = targetBudget > 0 ? Math.min(100, Math.round((totalSpent / targetBudget) * 100)) : 0;
  const memberTarget = ledger.fundSettings?.memberTargetAmount || 0;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Overview & Budget Card */}
      <div className="rounded-2xl p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-800 text-zinc-900 dark:text-white shadow-xl border border-zinc-200 dark:border-zinc-800/50">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">公積金總餘額</h3>
            <div className="text-4xl font-bold">${totalBalance.toLocaleString()}</div>
          </div>
          <button 
            onClick={() => setIsEditingBudget(!isEditingBudget)}
            className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
          >
            <Settings2 className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>

        {isEditingBudget ? (
          <div className="bg-zinc-50 dark:bg-white/10 rounded-xl p-4 space-y-4 dark:backdrop-blur-md border border-zinc-200 dark:border-white/10 mb-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">總預算目標 (月)</label>
              <input 
                type="number" 
                value={budgetInput} 
                onChange={e => setBudgetInput(e.target.value)}
                className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/20 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 10000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">每人應繳額度</label>
              <input 
                type="number" 
                value={memberTargetInput} 
                onChange={e => setMemberTargetInput(e.target.value)}
                className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/20 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 1000"
              />
            </div>
            <button 
              onClick={handleSaveSettings}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
            >
              儲存設定
            </button>
          </div>
        ) : (
          targetBudget > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2 text-zinc-600 dark:text-zinc-300">
                <span>預算消耗 ({budgetPercentage}%)</span>
                <span>${totalSpent.toLocaleString()} / ${targetBudget.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full bg-zinc-200 dark:bg-black/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${budgetPercentage > 90 ? 'bg-rose-500' : budgetPercentage > 75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
            </div>
          )
        )}
      </div>

      {/* Grid Layout for Desktop, Stack for Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Members Status */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">成員繳費進度</h3>
          </div>
          <div className="space-y-3">
            {members.map(member => {
              const paid = memberStats[member.userId] || 0;
              const isPaid = paid >= memberTarget;
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-medium text-sm">
                      {member.nickname ? member.nickname.slice(0, 1) : member.userId.slice(0,1)}
                    </div>
                    <div>
                      <div className="font-medium text-sm dark:text-zinc-200">{member.nickname || `User ${member.userId.slice(0,4)}`}</div>
                      <div className="text-xs text-zinc-500">已繳: ${paid.toLocaleString()}</div>
                    </div>
                  </div>
                  {memberTarget > 0 && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {isPaid ? (
                        <><CheckCircle2 className="w-4 h-4" /> 已繳清</>
                      ) : (
                        <><AlertCircle className="w-4 h-4" /> 欠款 ${(memberTarget - paid).toLocaleString()}</>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Reimbursements */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold">代墊待撥款 ({reimbursements.length})</h3>
          </div>
          {reimbursements.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              目前沒有待撥款的代墊項目
            </div>
          ) : (
            <div className="space-y-3">
              {reimbursements.map(tx => (
                <div key={tx.id} className="flex flex-col gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{tx.details}</div>
                      <div className="text-xs text-zinc-500">代墊人: User {tx.userId.slice(0,4)}</div>
                    </div>
                    <div className="font-bold text-amber-600 dark:text-amber-400">
                      ${tx.amount.toLocaleString()}
                    </div>
                  </div>
                  <button 
                    onClick={() => onSettleReimbursement(tx)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    核准並撥款
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold">支出分佈</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => typeof value === 'number' ? `$${value.toLocaleString()}` : `$${value}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {categoryData.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span>{cat.name} (${cat.value.toLocaleString()})</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
