'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getSavingGoals, saveSavingGoal, updateSavingGoalAmount, deleteSavingGoal, updateSavingGoalsOrder } from '@/lib/savingGoals';
import type { SavingGoal } from '@/types';
import { format } from 'date-fns';
import { Target, Plus, Check, PlusCircle, Trash2, Bell, GripVertical, Info } from 'lucide-react';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableGoalCard({ 
  goal, 
  setAddAmountValue,
  setAddAmountGoalId,
  isReminderDue
}: { 
  goal: SavingGoal; 
  setAddAmountValue: (val: string) => void;
  setAddAmountGoalId: (id: string) => void;
  isReminderDue: (g: SavingGoal) => boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
  const isCompleted = goal.currentAmount >= goal.targetAmount;

  return (
    <div ref={setNodeRef} style={style} className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 flex flex-col">
      {isCompleted && (
        <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg z-10">
          <Check className="h-5 w-5" />
        </div>
      )}
      
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 line-clamp-1">{goal.name}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              預計 {format(new Date(goal.targetDate), 'yyyy/MM/dd')} 達成
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/saving-goals/detail?id=${goal.id}`} className="p-1 text-zinc-400 hover:text-blue-500">
            <span className="sr-only">Info</span>
            <Info className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="mb-1 flex items-end justify-between">
        <div className="text-2xl font-bold text-zinc-900 dark:text-white">
          ${goal.currentAmount.toLocaleString()}
        </div>
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          / ${goal.targetAmount.toLocaleString()}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-600 dark:bg-blue-500'}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>

      <div className="flex items-center justify-between text-xs font-medium">
        <span className={isCompleted ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
          {percent}%
        </span>
        
        {!isCompleted && isReminderDue(goal) && (
          <span className="flex items-center text-orange-500">
            <Bell className="mr-1 h-3 w-3" />
            該存錢囉！
          </span>
        )}
      </div>

      <div className="mt-auto pt-4">
        {!isCompleted && (
          <button
            onClick={() => {
              setAddAmountValue(goal.isFixedAmount && goal.fixedAmountValue ? goal.fixedAmountValue.toString() : '');
              setAddAmountGoalId(goal.id);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            <PlusCircle className="h-4 w-4" />
            紀錄存錢
          </button>
        )}
      </div>
    </div>
  );
}


export default function SavingGoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [targetDate, setTargetDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [reminderFrequency, setReminderFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'none'>('none');
  const [isFixedAmount, setIsFixedAmount] = useState(false);
  const [fixedAmountValue, setFixedAmountValue] = useState('');

  // Add Amount State
  const [addAmountGoalId, setAddAmountGoalId] = useState<string | null>(null);
  const [addAmountValue, setAddAmountValue] = useState('');

  useEffect(() => {
    if (!user) return;
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const fetched = await getSavingGoals(user.uid);
      setGoals(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setTargetDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setReminderFrequency('none');
    setIsFixedAmount(false);
    setFixedAmountValue('');
  };

  const openEditForm = (goal: SavingGoal) => {
    setEditingGoal(goal);
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
    if (!user) return;

    try {
      const goalData: Omit<SavingGoal, 'id' | 'createdAt'> = {
        userId: user.uid,
        name,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount),
        targetDate: new Date(targetDate).getTime(),
        reminderFrequency,
        isFixedAmount,
      };

      if (isFixedAmount && fixedAmountValue) {
        goalData.fixedAmountValue = Number(fixedAmountValue);
      }

      await saveSavingGoal(user.uid, goalData, editingGoal?.id);

      await loadGoals();
      resetForm();
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  const handleAddAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !addAmountGoalId || !addAmountValue) return;

    try {
      await updateSavingGoalAmount(user.uid, addAmountGoalId, Number(addAmountValue));
      await loadGoals();
      setAddAmountGoalId(null);
      setAddAmountValue('');
    } catch (e) {
      console.error(e);
      alert('更新失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('確定要刪除此存錢目標嗎？')) return;
    try {
      await deleteSavingGoal(user.uid, id);
      await loadGoals();
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  // Check if reminder is due (simplified logic for in-app display)
  const isReminderDue = (goal: SavingGoal) => {
    if (goal.reminderFrequency === 'none') return false;
    // Real implementation would check last saved date, here we just mock
    return goal.isFixedAmount && goal.currentAmount < goal.targetAmount;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = goals.findIndex((g) => g.id === active.id);
      const newIndex = goals.findIndex((g) => g.id === over.id);

      const newGoals = arrayMove(goals, oldIndex, newIndex);
      setGoals(newGoals);

      if (user) {
        const updates = newGoals.map((g, idx) => ({
          id: g.id,
          order: idx,
        }));
        try {
          await updateSavingGoalsOrder(user.uid, updates);
        } catch (error) {
          console.error('Failed to update order:', error);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">存錢目標</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">規劃並達成您的夢想基金</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm md:h-auto md:w-auto md:px-4 md:py-2 md:rounded-lg"
        >
          <Plus className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline font-medium">新增目標</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">{editingGoal ? '編輯目標' : '新增存錢目標'}</h2>
          <form onSubmit={handleSaveGoal} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標名稱</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：旅遊金、買車基金"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標金額</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目前已存 (可選)</label>
                <input
                  type="number"
                  min="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">目標完成日</label>
                <DatePicker
                  type="datetime-local"
                  required
                  value={targetDate}
                  onChange={(val) => setTargetDate(val)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">提醒頻率</label>
                <select
                  value={reminderFrequency}
                  onChange={(e) => setReminderFrequency(e.target.value as any)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="none">不提醒</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                </select>
              </div>

              <div className="md:col-span-2 mt-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={isFixedAmount}
                    onChange={(e) => setIsFixedAmount(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  這是一個定期定額的存錢計畫
                </label>
              </div>

              {isFixedAmount && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">每期預計存入金額</label>
                  <input
                    type="number"
                    min="1"
                    value={fixedAmountValue}
                    onChange={(e) => setFixedAmountValue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editingGoal ? '更新' : '建立'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Amount Modal */}
      {addAmountGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">紀錄存錢</h3>
            <form onSubmit={handleAddAmount} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">存入金額</label>
                <input
                  type="number"
                  required
                  min="1"
                  autoFocus
                  value={addAmountValue}
                  onChange={(e) => setAddAmountValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddAmountGoalId(null)}
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

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>
      ) : goals.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <Target className="mb-2 h-10 w-10 text-zinc-400" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">尚未建立存錢目標</p>
          <p className="text-xs text-zinc-400 mt-1">開始規劃您的第一個目標吧！</p>
        </div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={goals.map(g => g.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {goals.map(goal => (
                <SortableGoalCard
                  key={goal.id}
                  goal={goal}
                  setAddAmountValue={setAddAmountValue}
                  setAddAmountGoalId={setAddAmountGoalId}
                  isReminderDue={isReminderDue}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
