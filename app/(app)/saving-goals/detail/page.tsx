'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSavingGoal, getSavingRecords, saveSavingGoal, deleteSavingGoal, updateSavingRecord, deleteSavingRecord, updateSavingGoalAmount } from '@/lib/savingGoals';
import type { SavingGoal, SavingRecord } from '@/types';
import { format } from 'date-fns';
import { ArrowLeft, Target, Trash2, Edit, Save, X, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/DatePicker';
import { Suspense } from 'react';

function SavingGoalDetailContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const goalId = searchParams.get('id');

  const [goal, setGoal] = useState<SavingGoal | null>(null);
  const [records, setRecords] = useState<SavingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [targetDate, setTargetDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [reminderFrequency, setReminderFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'none'>('none');
  const [isFixedAmount, setIsFixedAmount] = useState(false);
  const [fixedAmountValue, setFixedAmountValue] = useState('');

  // Record Edit State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecordAmount, setEditRecordAmount] = useState('');
  const [editRecordNote, setEditRecordNote] = useState('');

  // Add Record State
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [addRecordAmount, setAddRecordAmount] = useState('');
  const [addRecordDate, setAddRecordDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [addRecordNote, setAddRecordNote] = useState('');

  useEffect(() => {
    if (!user || !goalId) return;
    loadData();
  }, [user, goalId]);

  const loadData = async () => {
    if (!user || !goalId) return;
    setLoading(true);
    try {
      const g = await getSavingGoal(user.uid, goalId);
      if (g) {
        setGoal(g);
        const r = await getSavingRecords(user.uid, goalId);
        setRecords(r);
      } else {
        router.push('/saving-goals');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = () => {
    if (!goal) return;
    setName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setCurrentAmount(goal.currentAmount.toString());
    setTargetDate(format(new Date(goal.targetDate), "yyyy-MM-dd'T'HH:mm"));
    setReminderFrequency(goal.reminderFrequency);
    setIsFixedAmount(goal.isFixedAmount);
    setFixedAmountValue(goal.fixedAmountValue?.toString() || '');
    setIsFormOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goal) return;

    try {
      const goalData: Omit<SavingGoal, 'id' | 'createdAt'> = {
        userId: user.uid,
        name,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount),
        targetDate: new Date(targetDate).getTime(),
        reminderFrequency,
        isFixedAmount,
        order: goal.order, // preserve order
      };

      if (isFixedAmount && fixedAmountValue) {
        goalData.fixedAmountValue = Number(fixedAmountValue);
      }

      await saveSavingGoal(user.uid, goalData, goal.id);
      setIsFormOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  const handleDelete = async () => {
    if (!user || !goal || !confirm('確定要刪除此存錢目標嗎？這將會同時刪除所有相關紀錄。')) return;
    try {
      await deleteSavingGoal(user.uid, goal.id);
      router.push('/saving-goals');
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const handleDeleteRecord = async (record: SavingRecord) => {
    if (!user || !goalId || !confirm('確定要刪除這筆紀錄嗎？這會扣除已存入的金額。')) return;
    try {
      await deleteSavingRecord(user.uid, goalId, record.id, record.amount);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const startEditRecord = (record: SavingRecord) => {
    setEditingRecordId(record.id);
    setEditRecordAmount(record.amount.toString());
    setEditRecordNote(record.note || '');
  };

  const cancelEditRecord = () => {
    setEditingRecordId(null);
    setEditRecordAmount('');
    setEditRecordNote('');
  };

  const handleUpdateRecord = async (e: React.FormEvent, record: SavingRecord) => {
    e.preventDefault();
    if (!user || !goalId) return;
    try {
      await updateSavingRecord(
        user.uid, 
        goalId, 
        record.id, 
        record.amount, 
        Number(editRecordAmount), 
        editRecordNote
      );
      cancelEditRecord();
      await loadData();
    } catch (error) {
      console.error(error);
      alert('更新失敗');
    }
  };

  const openAddRecordModal = () => {
    if (!goal) return;
    setAddRecordAmount(goal.isFixedAmount && goal.fixedAmountValue ? goal.fixedAmountValue.toString() : '');
    setAddRecordDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setAddRecordNote('');
    setIsAddRecordOpen(true);
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalId || !addRecordAmount) return;

    try {
      await updateSavingGoalAmount(
        user.uid, 
        goalId, 
        Number(addRecordAmount), 
        addRecordNote, 
        new Date(addRecordDate).getTime()
      );
      setIsAddRecordOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      alert('更新失敗');
    }
  };

  if (loading) {
    return <div className="flex h-32 items-center justify-center text-sm text-zinc-500">載入中...</div>;
  }

  if (!goal) return null;

  const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/saving-goals" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
          <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{goal.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">存錢目標紀錄與設定</p>
        </div>
        <button onClick={openAddRecordModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 md:h-auto md:w-auto md:px-4 md:py-2 md:rounded-lg">
          <PlusCircle className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline font-medium">紀錄存錢</span>
        </button>
        <button onClick={openEditForm} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 md:h-auto md:w-auto md:px-4 md:py-2 md:rounded-lg">
          <Edit className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline font-medium">編輯</span>
        </button>
        <button onClick={handleDelete} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 md:h-auto md:w-auto md:px-4 md:py-2 md:rounded-lg">
          <Trash2 className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline font-medium">刪除</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">編輯目標</h2>
          <form onSubmit={handleSaveGoal} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標名稱</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標金額</label>
                <input type="number" required min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目前已存</label>
                <input type="number" min="0" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標完成日</label>
                <DatePicker type="datetime-local" required value={targetDate} onChange={(val) => setTargetDate(val)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">提醒頻率</label>
                <select value={reminderFrequency} onChange={(e) => setReminderFrequency(e.target.value as any)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="none">不提醒</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div className="md:col-span-2 mt-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={isFixedAmount} onChange={(e) => setIsFixedAmount(e.target.checked)} className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                  這是一個定期定額的存錢計畫
                </label>
              </div>
              {isFixedAmount && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">每期預計存入金額</label>
                  <input type="number" min="1" value={fixedAmountValue} onChange={(e) => setFixedAmountValue(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">取消</button>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">更新</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Record Modal */}
      {isAddRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">紀錄存錢</h3>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">存入時間</label>
                <DatePicker type="datetime-local" required value={addRecordDate} onChange={(val) => setAddRecordDate(val)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">存入金額</label>
                <input
                  type="number"
                  required
                  min="1"
                  autoFocus
                  value={addRecordAmount}
                  onChange={(e) => setAddRecordAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">備註 (可選)</label>
                <input
                  type="text"
                  value={addRecordNote}
                  onChange={(e) => setAddRecordNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRecordOpen(false)}
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  確認存入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Overview */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-2 flex items-end justify-between">
          <div className="text-3xl font-bold text-zinc-900 dark:text-white">
            ${goal.currentAmount.toLocaleString()}
          </div>
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            / ${goal.targetAmount.toLocaleString()}
          </div>
        </div>
        <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-green-500' : 'bg-blue-600 dark:bg-blue-500'}`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between text-sm font-medium">
          <span className={percent >= 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
            進度 {percent}%
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            預計 {format(new Date(goal.targetDate), 'yyyy/MM/dd')} 達成
          </span>
        </div>
      </div>

      {/* Records List */}
      <div>
        <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">存錢紀錄</h3>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-12 dark:border-zinc-700">
            <Target className="mb-2 h-10 w-10 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">尚無存錢紀錄</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {records.map((record) => (
                <li key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 gap-4">
                  {editingRecordId === record.id ? (
                    <form onSubmit={(e) => handleUpdateRecord(e, record)} className="flex-1 flex flex-col sm:flex-row gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        required 
                        value={editRecordAmount} 
                        onChange={(e) => setEditRecordAmount(e.target.value)} 
                        className="w-full sm:w-32 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900" 
                        placeholder="金額" 
                      />
                      <input 
                        type="text" 
                        value={editRecordNote} 
                        onChange={(e) => setEditRecordNote(e.target.value)} 
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900" 
                        placeholder="備註 (可選)" 
                      />
                      <div className="flex gap-2 justify-end sm:justify-start">
                        <button type="submit" className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"><Save className="h-4 w-4"/></button>
                        <button type="button" onClick={cancelEditRecord} className="p-1.5 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"><X className="h-4 w-4"/></button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          存入 ${record.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {format(new Date(record.date), 'yyyy/MM/dd HH:mm')}
                          {record.note && ` • ${record.note}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditRecord(record)} className="p-1.5 text-zinc-400 hover:text-blue-500">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteRecord(record)} className="p-1.5 text-zinc-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SavingGoalDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-zinc-500">載入中...</div>}>
      <SavingGoalDetailContent />
    </Suspense>
  );
}
