'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Category } from '@/types';
import { Plus, ArrowLeft, ArrowUpRight, ArrowDownRight, GripVertical, ArrowUpDown, Info } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { mergeCategories } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
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

interface SortableCategoryItemProps {
  cat: Category;
  isReorderMode?: boolean;
}

function SortableCategoryItem({ cat, isReorderMode }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

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
      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-sm hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-700 transition-colors group"
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
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{cat.name}</div>
        {!cat.isCustom && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">系統預設</span>}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/settings/categories/detail?id=${cat.id}`}
          className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 bg-zinc-100 hover:bg-blue-50 dark:hover:text-blue-400 dark:bg-zinc-800 dark:hover:bg-blue-900/30 rounded-full transition-colors"
          title="檢視"
        >
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Form State
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [name, setName] = useState('');

  useEffect(() => {
    if (user) loadCategories();
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'categories'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCustomCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = mergeCategories(DEFAULT_CATEGORIES, customCategories);
  
  // Sort by order, using index as fallback if order is undefined
  allCategories.forEach((cat: any, idx: number) => {
    if (cat.order === undefined) cat.order = idx;
  });
  allCategories.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const expenseCategories = allCategories.filter((c: any) => c.type === 'expense');
  const incomeCategories = allCategories.filter((c: any) => c.type === 'income');

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setIsSaving(true);
    
    try {
      // Adding new custom category
      const newCat = {
        name,
        type,
        icon: type === 'expense' ? 'shopping-bag' : 'plus-circle',
        isCustom: true,
        order: type === 'expense' ? expenseCategories.length : incomeCategories.length
      };
      
      const docRef = await addDoc(collection(db, 'users', user.uid, 'categories'), newCat);
      setCustomCategories([...customCategories, { id: docRef.id, ...newCat }]);
      
      setIsAdding(false);
      setName('');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
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

  const handleDragEnd = async (event: DragEndEvent, listType: 'expense' | 'income') => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const items = listType === 'expense' ? expenseCategories : incomeCategories;
      const oldIndex = items.findIndex((item: any) => item.id === active.id);
      const newIndex = items.findIndex((item: any) => item.id === over?.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      
      const newCustomCats = [...customCategories];
      
      const promises = newItems.map(async (item: any, index: number) => {
        const existingIdx = newCustomCats.findIndex(c => c.id === item.id);
        
        if (existingIdx >= 0) {
          newCustomCats[existingIdx] = { ...newCustomCats[existingIdx], order: index };
        } else {
          newCustomCats.push({ ...item, order: index });
        }

        if (user) {
          return setDoc(doc(db, 'users', user.uid, 'categories', item.id), { order: index }, { merge: true });
        }
      });
      
      setCustomCategories(newCustomCats);
      await Promise.all(promises);
    }
  };

  const actionButtons = (
    <div className="flex items-center gap-1 md:gap-2">
      {allCategories.length > 1 && (
        <button
          onClick={() => {
            if (isAdding) {
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
          setName('');
          setType('expense');
          setIsAdding(true);
        }}
        className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        <Plus className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">新增</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="交易分類管理" backHref="/settings" rightAction={actionButtons} />
      <header className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">交易分類管理</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              管理您的收入與支出分類
            </p>
          </div>
        </div>
        {actionButtons}
      </header>

      {isAdding && (
        <form onSubmit={handleAddOrEdit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label className="mb-1 block text-sm font-medium">類型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                  type === 'expense'
                    ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-400'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowDownRight className="h-4 w-4" />
                支出
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                  type === 'income'
                    ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                收入
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">分類名稱 *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：訂閱服務"
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">載入中...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* 支出分類 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-red-500" />
              支出分類
            </h2>
            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, 'expense')}
              >
                <SortableContext
                  items={expenseCategories}
                  strategy={verticalListSortingStrategy}
                >
                  {expenseCategories.map((cat: any) => (
                    <SortableCategoryItem
                      key={cat.id}
                      cat={cat}
                      isReorderMode={isReorderMode}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* 收入分類 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-500" />
              收入分類
            </h2>
            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, 'income')}
              >
                <SortableContext
                  items={incomeCategories}
                  strategy={verticalListSortingStrategy}
                >
                  {incomeCategories.map((cat: any) => (
                    <SortableCategoryItem
                      key={cat.id}
                      cat={cat}
                      isReorderMode={isReorderMode}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
