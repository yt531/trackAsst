'use client';

import { Ledger, Transaction, LedgerMember, Category } from '@/types';
import { useState, useMemo, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { Settings2, Wallet, Users, CheckCircle2, AlertCircle, PieChart as PieChartIcon, Plus, X, Check } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { updateLedger, getFundCollections, createFundCollection, updateFundCollection, recalculateCollection } from '@/lib/ledger';
import { MemberSelector } from '@/components/ui/MemberSelector';
import { approveTransaction, rejectTransaction } from '@/lib/transactions';
import type { FundCollection, AppNotification } from '@/types';
import { useAuth } from '@/components/AuthProvider';

interface FundDashboardProps {
  ledger: Ledger;
  transactions: Transaction[];
  onSettleReimbursement: (tx: Transaction) => Promise<void>;
}

export function FundDashboard({ ledger, transactions, onSettleReimbursement }: FundDashboardProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [memberTargetInput, setMemberTargetInput] = useState(ledger.fundSettings?.memberTargetAmount?.toString() || '');
  const [collections, setCollections] = useState<FundCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  
  // Start/Edit Collection Modal State
  const [isStartCollectionModalOpen, setIsStartCollectionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionAmount, setNewCollectionAmount] = useState('');
  const [collectionMode, setCollectionMode] = useState<'per_person'|'total'>('per_person');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isStartingCollection, setIsStartingCollection] = useState(false);

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcNote, setRecalcNote] = useState('加入新成員重新計算費用');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [pendingRecalcData, setPendingRecalcData] = useState<any>(null);
  
  const [notificationPreview, setNotificationPreview] = useState<{isOpen: boolean, results: any[]}>({isOpen: false, results: []});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, 'ledgers', ledger.id, 'members'));
        const snap = await getDocs(q);
        const membersData = snap.docs.map(d => d.data() as LedgerMember);
        setMembers(membersData);

        if (ledger.mode === 'shared_fund') {
          const fetchedCollections = await getFundCollections(ledger.id);
          setCollections(fetchedCollections);
          if (fetchedCollections.length > 0) {
            setSelectedCollectionId(fetchedCollections[0].id); // default to most recent
          }
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ledger.id, ledger.mode]);

    const {
    totalBalance,
    availableBalance,
    totalMemberBalance,
    totalSpent,
    reimbursements,
    pendingApprovals,
    categoryData,
    memberStats
  } = useMemo(() => {
    let balance = 0;
    let spent = 0;
    const reimbursementsList: Transaction[] = [];
    const pendingList: Transaction[] = [];
    const categoryTotals: Record<string, number> = {};
    const memberPayments: Record<string, number> = {}; // Tracks payments for the SELECTED collection

    transactions.forEach(tx => {
      if (tx.type === 'income') {
        if (tx.approvalStatus === 'pending') {
          pendingList.push(tx);
        } else {
          balance += tx.amount;
          if (tx.collectionId === selectedCollectionId) {
            memberPayments[tx.userId] = (memberPayments[tx.userId] || 0) + tx.amount;
          }
        }
      } else if (tx.type === 'expense') {
        const isReimbursement = tx.isAdvancePayment && tx.advancePaymentStatus === 'unsettled';
        
        if (isReimbursement) {
          reimbursementsList.push(tx);
        } else {
          balance -= tx.amount;
          spent += tx.amount;
          categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + tx.amount;
        }
      } else if (tx.type === 'settlement') {
        balance -= tx.amount;
      }
    });

    const catData = Object.keys(categoryTotals).map(catId => ({
      name: catId, 
      value: categoryTotals[catId]
    })).sort((a, b) => b.value - a.value);

    let totalMemberBalance = 0;
    members.forEach(m => {
      totalMemberBalance += (m.balance || 0);
    });

    return {
      totalBalance: balance,
      availableBalance: balance - totalMemberBalance,
      totalMemberBalance,
      totalSpent: spent,
      reimbursements: reimbursementsList,
      pendingApprovals: pendingList,
      categoryData: catData,
      memberStats: memberPayments
    };
  }, [transactions, selectedCollectionId, members]);

  const handleSaveSettings = async () => {
    // Deprecated for memberTargetAmount, but keeping for future settings
    setIsEditingSettings(false);
  };

  const currentUserRole = members.find(m => m.userId === user?.uid)?.role;

  const handleStartCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCollectionTitle || !newCollectionAmount) return;
    
    const numAmount = Number(newCollectionAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('請輸入有效的金額');
      return;
    }

    if (members.length > 2 && !members.some(m => m.role === 'vice_admin')) {
      alert('請先至設定指派至少一位副管理員，才可發起收款');
      return;
    }

    setIsStartingCollection(true);
    try {
      if (isEditMode && selectedCollectionId) {
        // Edit mode means Recalculate
        const newTargetAmount = collectionMode === 'per_person' ? numAmount : numAmount / selectedMemberIds.length;
        const newTotalAmount = collectionMode === 'total' ? numAmount : undefined;
        
        setPendingRecalcData({
          collectionId: selectedCollectionId,
          newTargetAmount,
          newMemberIds: selectedMemberIds,
          newTotalAmount
        });
        setIsStartCollectionModalOpen(false);
        setIsNoteModalOpen(true);
      } else {
        const newRef = doc(collection(db, 'ledgers')); // just to generate ID
        await createFundCollection(ledger.id, {
          id: newRef.id,
          ledgerId: ledger.id,
          title: newCollectionTitle,
          targetAmount: collectionMode === 'per_person' ? numAmount : numAmount / selectedMemberIds.length,
          totalAmount: collectionMode === 'total' ? numAmount : undefined,
          memberIds: selectedMemberIds,
          createdAt: Date.now(),
          createdBy: user.uid,
          status: 'active'
        });
        setIsStartCollectionModalOpen(false);
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert(isEditMode ? '重新計算失敗' : '發起收款失敗');
    } finally {
      setIsStartingCollection(false);
    }
  };

  const executeRecalculation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pendingRecalcData) return;
    setIsRecalculating(true);
    try {
      const results = await recalculateCollection(
        ledger.id,
        pendingRecalcData.collectionId,
        pendingRecalcData.newTargetAmount,
        pendingRecalcData.newMemberIds,
        pendingRecalcData.newTotalAmount,
        user.uid,
        recalcNote
      );
      
      setIsNoteModalOpen(false);
      
      if (results.length > 0) {
        setNotificationPreview({ isOpen: true, results });
      } else {
        alert('重新計算完成，本次無溢收款產生。');
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert('重新計算失敗');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSendNotifications = async (send: boolean) => {
    if (send && user) {
      for (const res of notificationPreview.results) {
        await setDoc(doc(collection(db, 'users', res.userId, 'notifications')), {
          userId: res.userId,
          type: 'ledger_expense_update',
          title: '溢收款已轉入餘額',
          message: `由於收款重新分攤，您的溢繳金額 ${res.overflow} 元已轉入您的帳本餘額。（備註：${recalcNote}）`,
          link: `/ledgers/detail?id=${ledger.id}`,
          isRead: false,
          createdAt: Date.now(),
        } as Omit<AppNotification, 'id'>);
      }
    }
    window.location.reload();
  };

  const openStartModal = () => {
    setIsEditMode(false);
    setNewCollectionTitle('');
    setNewCollectionAmount('');
    setCollectionMode('per_person');
    setSelectedMemberIds(members.map(m => m.userId));
    setIsStartCollectionModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedCollection) return;
    setIsEditMode(true);
    setNewCollectionTitle(selectedCollection.title);
    setCollectionMode(selectedCollection.totalAmount ? 'total' : 'per_person');
    setNewCollectionAmount(selectedCollection.totalAmount ? selectedCollection.totalAmount.toString() : selectedCollection.targetAmount.toString());
    setSelectedMemberIds(selectedCollection.memberIds || members.map(m => m.userId));
    setIsStartCollectionModalOpen(true);
  };

  const handleCloseCollection = async (id: string) => {
    if (!confirm('確定要關閉此收款期數嗎？關閉後成員將無法再繳交此期款項。')) return;
    try {
      await updateFundCollection(ledger.id, id, { status: 'closed' });
      window.location.reload();
    } catch (err) {
      alert('關閉失敗');
    }
  };

  const handleApproveTransaction = async (txId: string) => {
    if (!user) return;
    if (!confirm('確定收到款項並核准嗎？')) return;
    try {
      await approveTransaction(ledger.id, txId, user.uid, user.uid);
      window.location.reload();
    } catch (err) {
      alert('核准失敗');
    }
  };

  const handleRejectTransaction = async (txId: string) => {
    if (!user) return;
    const reason = window.prompt('請輸入退回說明（必填）：');
    if (reason === null) return; // user cancelled
    if (reason.trim() === '') {
      alert('退回說明不能為空');
      return;
    }
    
    try {
      await rejectTransaction(ledger.id, txId, user.uid, user.uid, reason);
      window.location.reload();
    } catch (err) {
      alert('退回失敗');
    }
  };

  const canApprove = (tx: Transaction) => {
    const submitterRole = members.find(m => m.userId === tx.userId)?.role || 'viewer';
    if (submitterRole === 'editor' || submitterRole === 'viewer') {
      return currentUserRole === 'admin' || currentUserRole === 'vice_admin';
    }
    if (submitterRole === 'vice_admin') {
      return currentUserRole === 'admin';
    }
    if (submitterRole === 'admin') {
      if (members.length > 2) {
        return currentUserRole === 'vice_admin';
      } else {
        return currentUserRole !== 'admin';
      }
    }
    return false;
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">載入中...</div>;
  }

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);
  const memberTarget = selectedCollection?.targetAmount || 0;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const showWarning = totalBalance <= 0 && (currentUserRole === 'admin' || currentUserRole === 'editor' || currentUserRole === 'vice_admin');

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {showWarning && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg flex gap-3 items-start shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-800 dark:text-red-300">⚠️ 公積金餘額已見底</h4>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">目前公積金餘額為 0 或更低，請提醒成員存入款項以維持運作！</p>
          </div>
        </div>
      )}

      {/* Overview & Budget Card */}
      <div className="rounded-2xl p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-zinc-800 text-zinc-900 dark:text-white shadow-xl border border-zinc-200 dark:border-zinc-800/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex-1 w-full">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">可用公積金 (排除成員溢繳)</h3>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">${availableBalance.toLocaleString()}</div>
            {totalMemberBalance > 0 && (
              <div className="text-xs text-zinc-500 mt-2">
                總現金: ${totalBalance.toLocaleString()} (含成員溢繳餘額: ${totalMemberBalance.toLocaleString()})
              </div>
            )}
          </div>
          {ledger.mode === 'shared_fund' && (currentUserRole === 'admin' || currentUserRole === 'vice_admin') && (
            <button 
              onClick={openStartModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              發起收款
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout for Desktop, Stack for Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Members Status */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">成員繳費進度</h3>
            </div>
            {collections.length > 0 && (
              <select
                value={selectedCollectionId}
                onChange={e => setSelectedCollectionId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.title} {c.status === 'closed' ? '(已關閉)' : ''}</option>
                ))}
              </select>
            )}
          </div>
          
          {collections.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              尚未發起任何收款
            </div>
          ) : (
            <>
              {selectedCollection?.status === 'active' && (currentUserRole === 'admin' || currentUserRole === 'vice_admin') && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={openEditModal}
                    className="flex-1 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50 transition-colors"
                  >
                    編輯 / 重新分攤
                  </button>
                  <button
                    onClick={() => handleCloseCollection(selectedCollection.id)}
                    className="flex-1 py-1.5 text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded-lg hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-900/50 transition-colors"
                  >
                    關閉此收款期數
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {members.filter(m => (selectedCollection?.memberIds || members.map(m=>m.userId)).includes(m.userId)).map(member => {
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
          </>
          )}
        </section>

        {/* Pending Approvals */}
        {ledger.mode === 'shared_fund' && pendingApprovals.some(canApprove) && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-blue-200 dark:border-blue-900/30 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">待審核繳款</h3>
            </div>
            <div className="space-y-3">
              {pendingApprovals.filter(canApprove).map(tx => {
                const submitter = members.find(m => m.userId === tx.userId);
                const payer = tx.payerId ? members.find(m => m.userId === tx.payerId) : submitter;
                const isSubmitOnBehalf = tx.payerId && tx.payerId !== tx.userId;
                
                return (
                <div key={tx.id} className="flex flex-col gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">繳款：{tx.details || '無明細'}</div>
                      {isSubmitOnBehalf ? (
                        <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                          <div>送審人: {submitter?.nickname || `User ${tx.userId.slice(0,4)}`}</div>
                          <div>繳款人: {payer?.nickname || `User ${tx.payerId!.slice(0,4)}`}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 mt-1">繳款人: {submitter?.nickname || `User ${tx.userId.slice(0,4)}`}</div>
                      )}
                    </div>
                    <div className="font-bold text-blue-600 dark:text-blue-400">
                      {tx.type === 'expense' ? '-' : '+'}${tx.amount.toLocaleString()}
                    </div>
                  </div>
                  {tx.auditLogs && tx.auditLogs.length > 0 && (
                    <div className="mt-2 text-xs border-t border-blue-200/50 dark:border-blue-800/50 pt-2 space-y-1">
                      <div className="text-zinc-500 font-medium mb-1">審核紀錄：</div>
                      {tx.auditLogs.map((log, idx) => {
                        const actor = members.find(m => m.userId === log.by);
                        const actorName = actor?.nickname || `User ${log.by.slice(0,4)}`;
                        const logDate = new Date(log.at).toLocaleString();
                        return (
                          <div key={idx} className="text-zinc-600 dark:text-zinc-400">
                            [{logDate}] {actorName}{' '}
                            {log.type === 'rejected' && <span className="text-red-500">退回: {log.reason}</span>}
                            {log.type === 'resubmitted' && <span className="text-blue-500">重新送出</span>}
                            {log.type === 'approved' && <span className="text-emerald-500">核准</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleRejectTransaction(tx.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      <X className="w-4 h-4" /> 退回
                    </button>
                    <button 
                      onClick={() => handleApproveTransaction(tx.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Check className="w-4 h-4" /> 核准收款
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </section>
        )}

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
                  {(currentUserRole === 'admin' || currentUserRole === 'vice_admin') ? (
                    <button 
                      onClick={() => onSettleReimbursement(tx)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors mt-2"
                    >
                      核准並撥款
                    </button>
                  ) : (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center py-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      等待管理員核准
                    </div>
                  )}
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

      {/* Start/Edit Collection Modal */}
      {isStartCollectionModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-xl font-bold">{isEditMode ? '編輯收款 / 重新分攤' : '發起新收款'}</h2>
              <button onClick={() => setIsStartCollectionModalOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleStartCollection} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">收款名稱</label>
                <input 
                  type="text" 
                  required
                  value={newCollectionTitle} 
                  onChange={e => setNewCollectionTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="例如: 9月公積金"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">收費模式</label>
                <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCollectionMode('per_person')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                      collectionMode === 'per_person' ? 'bg-white shadow text-blue-600' : 'text-zinc-500'
                    }`}
                  >每人固定金額</button>
                  <button
                    type="button"
                    onClick={() => setCollectionMode('total')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                      collectionMode === 'total' ? 'bg-white shadow text-blue-600' : 'text-zinc-500'
                    }`}
                  >總額平均分攤</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {collectionMode === 'per_person' ? '每人應繳額度' : '總目標額度'}
                </label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newCollectionAmount} 
                  onChange={e => setNewCollectionAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder={collectionMode === 'per_person' ? '例如: 200' : '例如: 1000'}
                />
              </div>

              <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <MemberSelector 
                  members={members}
                  selectedIds={selectedMemberIds}
                  onChange={setSelectedMemberIds}
                  currentUserUid={user?.uid}
                  footerText={collectionMode === 'total' && selectedMemberIds.length > 0 && newCollectionAmount ? `重新計算後每人應繳: ${(Number(newCollectionAmount) / selectedMemberIds.length).toFixed(2)}` : `參與分攤人數: ${selectedMemberIds.length} 人`}
                />
              </div>

              {/* End of new Collection Form */}

              <button 
                type="submit"
                disabled={isStartingCollection}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {isStartingCollection ? '處理中...' : (isEditMode ? '儲存並重新分攤' : '確認發起')}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal for Recalculation */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-xl font-bold mb-4">填寫溢收款備註</h2>
            <p className="text-sm text-zinc-500 mb-4">系統即將重新計算應繳金額，若有成員溢繳將自動轉入其個人餘額。請為此操作填寫備註：</p>
            <form onSubmit={executeRecalculation}>
              <input
                type="text"
                required
                value={recalcNote}
                onChange={e => setRecalcNote(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm mb-4 dark:border-zinc-700 dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button 
                type="submit"
                disabled={isRecalculating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {isRecalculating ? '計算中...' : '確認執行'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Notification Preview Modal */}
      {notificationPreview.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-xl font-bold mb-4">派發通知確認</h2>
            <p className="text-sm text-zinc-500 mb-4">重新計算完成，共有 {notificationPreview.results.length} 位成員產生溢收款。是否發送 App 內通知給這些成員？</p>
            <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 mb-4 font-mono">
              預覽內容：<br/>
              由於收款重新分攤，您的溢繳金額 X 元已轉入您的帳本餘額。（備註：{recalcNote}）
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleSendNotifications(false)}
                className="flex-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-medium py-2.5 rounded-xl transition-colors dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                不發送
              </button>
              <button 
                onClick={() => handleSendNotifications(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                發送通知
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FundDashboard;
