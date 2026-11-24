'use client';

import { confirmAsync } from '@/lib/confirm';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Tag } from '@/types';
import { Plus, ArrowLeft, Tags as TagsIcon, Search, ArrowUpDown } from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { showToast } from '@/lib/toast';
import { SortableTagItem } from '@/components/settings/SortableTagItem';

export default function TagsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Form State
  const [name, setName] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px drag distance to activate, allows clicking buttons
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadTags = useCallback(async () => {
    if (!user) return;
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'tags'));
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
      
      // Sort locally. If order is undefined, fallback to createdAt (older first or newer first? newer first was the old behavior. 
      // But for ordered lists, usually we just push to the end, so order = index).
      data.sort((a, b) => {
        const orderA = a.order ?? a.createdAt;
        const orderB = b.order ?? b.createdAt;
        return orderA - orderB;
      });
      
      setTags(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadTags();
  }, [user, loadTags]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setIsSaving(true);
    
    try {
      // New item goes to the end
      const maxOrder = tags.length > 0 ? Math.max(...tags.map(t => t.order ?? 0)) : 0;
      const newOrder = maxOrder + 1;

      const newTag = {
        name,
        userId: user.uid,
        order: newOrder,
        createdAt: Date.now(),
      };
      
      const docRef = await addDoc(collection(db, 'users', user.uid, 'tags'), newTag);
      setTags([...tags, { id: docRef.id, ...newTag }]);
      setIsAdding(false);
      setName('');
    } catch (e) {
      console.error(e);
      showToast('新增失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !(await confirmAsync('確定要刪除此標籤嗎？相關的交易紀錄不會被刪除，但可能會無法顯示正確標籤名稱。'))) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tags', id));
      setTags(tags.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      showToast('刪除失敗');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!user || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tags', id), {
        name: editName.trim()
      });
      setTags(tags.map(t => t.id === id ? { ...t, name: editName.trim() } : t));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      showToast('更新失敗');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !user || active.id === over.id) {
      return;
    }

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);

    const newTags = arrayMove(tags, oldIndex, newIndex);
    setTags(newTags);

    // Save new order to Firestore using batch update
    try {
      const batch = writeBatch(db);
      newTags.forEach((tag, index) => {
        // Only update if order changed or was undefined
        if (tag.order !== index) {
          const tagRef = doc(db, 'users', user.uid, 'tags', tag.id);
          batch.update(tagRef, { order: index });
          tag.order = index; // Update local state object too
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('Error saving tag order:', e);
      // Optional: show a toast notification here
    }
  };

  const filteredTags = tags.filter((tag) => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const actionButtons = (
    <div className="flex items-center gap-1 md:gap-2">
      {tags.length > 1 && (
        <button
          onClick={() => {
            if (isAdding) {
              showToast('請先取消新增才能使用排序功能');
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
            showToast('請先取消排序才能使用新增功能');
            return;
          }
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
      <PageHeader title="標籤管理" backHref="/settings" rightAction={actionButtons} />
      <header className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/settings')} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">標籤管理</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              管理您的交易標籤並拖曳排序
            </p>
          </div>
        </div>
        {actionButtons}
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label className="mb-1 block text-sm font-medium">標籤名稱 *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：旅遊、聚餐"
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
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
        <div className="grid gap-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
              <TagsIcon className="h-5 w-5 text-blue-500" />
              所有標籤
            </h2>

            {/* Search Input */}
            {tags.length > 0 && (
              <div className="relative max-w-xl mb-4">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋標籤..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            )}

            {tags.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4">目前沒有任何標籤。點擊上方「新增標籤」來建立。</div>
            ) : filteredTags.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4">找不到符合的標籤。</div>
            ) : (
              <div className="max-w-xl">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={filteredTags.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {filteredTags.map((tag) => (
                        <SortableTagItem
                          key={tag.id}
                          tag={tag}
                          editingId={editingId}
                          editName={editName}
                          setEditingId={setEditingId}
                          setEditName={setEditName}
                          handleUpdate={handleUpdate}
                          handleDelete={handleDelete}
                          isReorderMode={isReorderMode}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
