'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { getLedgerCategories, createLedgerCategory, updateLedgerCategory, deleteLedgerCategory, getLedgerMembers } from '@/lib/ledger';
import { Category, LedgerMember } from '@/types';
import { Plus, Trash2, ArrowLeft, ArrowUpRight, ArrowDownRight, Edit2, GripVertical } from 'lucide-react';
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

interface SortableCategoryItemProps {
  cat: Category;
  onEdit?: (cat: Category) => void;
  onDelete?: (id: string) => void;
  canEdit: boolean;
}

function SortableCategoryItem({ cat, onEdit, onDelete, canEdit }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled: !canEdit });

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
      className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 transition-colors group ${canEdit ? 'hover:border-blue-300 dark:hover:border-blue-700' : ''}`}
    >
      <div className="flex flex-1 items-center gap-3">
        {canEdit && (
          <button
            className="cursor-grab p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 touch-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{cat.name}</div>
        {!cat.isCustom && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">預設</span>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit?.(cat)}
            className="p-2 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete?.(cat.id)}
            className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SharedCategoriesPage() {
  const { user } = useAuth();
  const { activeLedger, activeLedgerId } = useLedger();
  const router = useRouter();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [canEdit, setCanEdit] = useState(false);

  // Form State
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [name, setName] = useState('');

  useEffect(() => {
    if (user && activeLedgerId) {
      loadData();
    } else if (!activeLedgerId) {
      router.push('/ledgers');
    }
  }, [user, activeLedgerId]);

  const loadData = async () => {
    if (!activeLedgerId || !user) return;
    try {
      setLoading(true);
      const cats = await getLedgerCategories(activeLedgerId);
      setCategories(cats);
      
      const members = await getLedgerMembers(activeLedgerId);
      const currentUserMember = members.find(m => m.userId === user.uid);
      
      let hasPerm = false;
      if (currentUserMember?.role === 'admin') {
        hasPerm = true;
      } else if (currentUserMember?.role === 'editor' && activeLedger?.settings?.allowMembersToCreateCategories) {
        hasPerm = true;
      }
      setCanEdit(hasPerm);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const incomeCategories = categories.filter(c => c.type === 'income').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeLedgerId || !name || !canEdit) return;
    setIsSaving(true);
    
    try {
      if (editingId) {
        const catToEdit = categories.find(c => c.id === editingId);
        if (!catToEdit) return;
        
        const updatedCat = {
          ...catToEdit,
          name,
          type,
        };
        
        await updateLedgerCategory(activeLedgerId, editingId, { name, type });
        setCategories(prev => prev.map(c => c.id === editingId ? updatedCat : c));
      } else {
        const newCatId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newCat: Category = {
          id: newCatId,
          ledgerId: activeLedgerId,
          name,
          type,
          icon: type === 'expense' ? 'shopping-bag' : 'plus-circle',
          isCustom: true,
          order: type === 'expense' ? expenseCategories.length : incomeCategories.length,
          createdBy: user.uid
        };
        
        await createLedgerCategory(activeLedgerId, newCat);
        setCategories([...categories, newCat]);
      }
      
      setIsAdding(false);
      setEditingId(null);
      setName('');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setType(cat.type as 'income' | 'expense');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!user || !activeLedgerId || !canEdit || !confirm('確定要刪除此分類嗎？')) return;
    try {
      await deleteLedgerCategory(activeLedgerId, id);
      setCategories(categories.filter(c => c.id !== id));
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
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
    if (!canEdit || !activeLedgerId) return;
    const { active, over } = event;

    if (active.id !== over?.id) {
      const items = listType === 'expense' ? expenseCategories : incomeCategories;
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over?.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      const newCats = [...categories];
      
      const promises = newItems.map(async (item, index) => {
        const existingIdx = newCats.findIndex(c => c.id === item.id);
        if (existingIdx >= 0) {
          newCats[existingIdx] = { ...newCats[existingIdx], order: index };
        }
        return updateLedgerCategory(activeLedgerId, item.id, { order: index });
      });
      
      setCategories(newCats);
      await Promise.all(promises);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader 
        title="帳本分類管理" 
        backHref={`/ledgers/detail/settings?id=${activeLedgerId}`} 
        rightAction={
          canEdit ? (
            <button
              onClick={() => {
                setEditingId(null);
                setName('');
                setType('expense');
                setIsAdding(!isAdding);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors md:hidden"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />
      <header className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/ledgers/detail/settings?id=${activeLedgerId}`)} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">帳本分類管理</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              管理 {activeLedger?.name} 的分類
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditingId(null);
              setName('');
              setType('expense');
              setIsAdding(!isAdding);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新增分類</span>
          </button>
        )}
      </header>

      {!canEdit && !loading && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/30 dark:bg-yellow-900/10 dark:text-yellow-200">
          您目前的權限無法編輯此帳本的分類。
        </div>
      )}

      {isAdding && canEdit && (
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
                setEditingId(null);
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
              {expenseCategories.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">目前沒有支出分類</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, 'expense')}
                >
                  <SortableContext
                    items={expenseCategories}
                    strategy={verticalListSortingStrategy}
                  >
                    {expenseCategories.map((cat) => (
                      <SortableCategoryItem
                        key={cat.id}
                        cat={cat}
                        canEdit={canEdit}
                        onEdit={handleEditClick}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* 收入分類 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-500" />
              收入分類
            </h2>
            <div className="space-y-2">
              {incomeCategories.length === 0 ? (
                <div className="text-sm text-zinc-500 py-4">目前沒有收入分類</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, 'income')}
                >
                  <SortableContext
                    items={incomeCategories}
                    strategy={verticalListSortingStrategy}
                  >
                    {incomeCategories.map((cat) => (
                      <SortableCategoryItem
                        key={cat.id}
                        cat={cat}
                        canEdit={canEdit}
                        onEdit={handleEditClick}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
