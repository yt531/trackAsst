'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, where } from 'firebase/firestore';
import { PaymentMethod, PaymentMethodType } from '@/types';
import { Plus, Trash2, ArrowLeft, Pencil, GripVertical, Info, ArrowUpDown } from 'lucide-react';
import { PREDEFINED_BANKS, PREDEFINED_EPAYS, PREDEFINED_CARDS } from '@/lib/constants';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePaymentMethodItemProps {
  method: PaymentMethod;
  isReorderMode?: boolean;
}

function SortablePaymentMethodItem({ method, isReorderMode }: SortablePaymentMethodItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: method.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-700 transition-colors group"
    >
      <div className="flex flex-1 items-center gap-3">
        {isReorderMode && (
          <button
            className="cursor-grab p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 touch-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xl">
            {method.type === 'bank' && '🏦'}
            {method.type === 'epay' && '📱'}
            {method.type === 'card' && '💳'}
            {method.type === 'cash' && '💵'}
            {method.type === 'unset' && '❓'}
          </div>
          <div>
            <div className="font-medium text-sm">{method.name}</div>
            {method.notes && <div className="text-xs text-zinc-500 dark:text-zinc-400">{method.notes}</div>}
            {method.isSystem && <div className="text-xs text-zinc-500 dark:text-zinc-400">系統預設</div>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/settings/payment-methods/detail?id=${method.id}`}
          className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 bg-zinc-100 hover:bg-blue-50 dark:text-zinc-400 dark:hover:text-blue-400 dark:bg-zinc-800 dark:hover:bg-blue-900/30 rounded-full transition-colors"
          title="檢視"
        >
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}


export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Form State
  const [type, setType] = useState<PaymentMethodType>('bank');
  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) loadMethods();
  }, [user]);

  const loadMethods = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'paymentMethods'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      
      const hasCash = data.find(m => m.id === 'cash');
      const hasUnset = data.find(m => m.id === 'unset');
      
      if (!hasCash) {
        data.push({ id: 'cash', type: 'cash', name: '現金', isSystem: true, order: -2 } as PaymentMethod);
      }
      if (!hasUnset) {
        data.push({ id: 'unset', type: 'unset', name: '未設定支付方式', isSystem: true, order: -1 } as PaymentMethod);
      }
      
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setMethods(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !user) return;
    setIsSaving(true);
    try {
      const methodData = {
        type,
        brandId,
        name,
        notes,
      };
      
      if (editingId && editingId !== 'new') {
        await updateDoc(doc(db, 'users', user.uid, 'paymentMethods', editingId), methodData);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'paymentMethods'), {
          ...methodData,
          isDefault: methods.length === 0,
          order: methods.length,
        });
      }
      
      await loadMethods();
      setEditingId(null);
      setName('');
      setNotes('');
      setBrandId('');
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setType(method.type);
    setBrandId(method.brandId || '');
    setName(method.name);
    setNotes(method.notes || '');
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('確定要刪除此支付方式嗎？這會將相關的支出紀錄設為「未設定支付方式」。')) return;
    try {
      // 1. Delete payment method
      await deleteDoc(doc(db, 'users', user.uid, 'paymentMethods', id));
      
      // 2. Update transactions to 'unset'
      const txQuery = query(collection(db, 'users', user.uid, 'transactions'), where('paymentMethodId', '==', id));
      const txSnapshot = await getDocs(txQuery);
      const updatePromises = txSnapshot.docs.map(txDoc => 
        updateDoc(doc(db, 'users', user.uid, 'transactions', txDoc.id), { paymentMethodId: 'unset' })
      );
      await Promise.all(updatePromises);
      
      await loadMethods();
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const getBrandList = () => {
    switch (type) {
      case 'bank': return PREDEFINED_BANKS;
      case 'epay': return PREDEFINED_EPAYS;
      case 'card': return PREDEFINED_CARDS;
      default: return [];
    }
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

    if (active.id !== over?.id) {
      setMethods((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        if (user) {
          Promise.all(
            newItems.map((item, index) => {
              const { id, ...rest } = item;
              return setDoc(doc(db, 'users', user.uid, 'paymentMethods', id), { ...rest, order: index }, { merge: true });
            })
          ).catch(console.error);
        }

        return newItems;
      });
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-1 md:gap-2">
      {methods.length > 1 && (
        <button
          onClick={() => {
            if (editingId) {
              alert('請先取消新增才能使用排序功能');
              return;
            }
            setIsReorderMode(!isReorderMode);
          }}
          className={`flex items-center gap-1 text-sm font-medium rounded-lg px-2 py-1 transition-colors ${
            isReorderMode
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          <ArrowUpDown className="h-5 w-5 md:h-4 md:w-4" />
          <span className="hidden md:inline">排序</span>
        </button>
      )}
      <button
        onClick={() => {
          if (isReorderMode) {
            alert('請先取消排序才能使用新增功能');
            return;
          }
          setEditingId('new');
          setType('bank');
          setBrandId('');
          setName('');
          setNotes('');
        }}
        className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        <Plus className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">新增</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="支付方式管理" backHref="/settings" rightAction={actionButtons} />
      <header className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">支付方式管理</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              管理您的銀行、電子支付與信用卡。
            </p>
          </div>
        </div>
        {actionButtons}
      </header>

      <div className="space-y-4 pb-20">
        {/* Action buttons moved to header */}

        {editingId && (
          <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div>
              <label className="mb-1 block text-sm font-medium">類型</label>
              <div className="flex gap-2">
                {[
                  { id: 'bank', emoji: '🏦', label: '銀行' },
                  { id: 'epay', emoji: '📱', label: '電子支付' },
                  { id: 'card', emoji: '💳', label: '票證/信用卡' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setType(t.id as PaymentMethodType);
                      setBrandId('');
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                      type === t.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">品牌 (選填)</label>
              <select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  const blist = getBrandList();
                  const found = blist.find(b => b.id === e.target.value);
                  if (found && !name) {
                    setName(found.name);
                  }
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">自訂 (無預設圖示)</option>
                {getBrandList().map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">名稱 *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：我的薪轉戶"
                className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">備註</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="選填"
                className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={isSaving} className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50">
                {isSaving ? '儲存中...' : '儲存'}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">載入中...</div>
        ) : (
          <div className="space-y-2">

            {methods.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-2">
                尚未新增其他支付方式。
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={methods}
                  strategy={verticalListSortingStrategy}
                >
                  {methods.map((method) => (
                    <SortablePaymentMethodItem
                      key={method.id}
                      method={method}
                      isReorderMode={isReorderMode}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
