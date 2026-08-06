'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Tag } from '@/types';
import { Plus, Trash2, ArrowLeft, Tags as TagsIcon, Edit2, GripVertical, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

interface SortableTagItemProps {
  tag: Tag;
  editingId: string | null;
  editName: string;
  setEditingId: (id: string | null) => void;
  setEditName: (name: string) => void;
  handleUpdate: (id: string) => void;
  handleDelete: (id: string) => void;
}

function SortableTagItem({
  tag,
  editingId,
  editName,
  setEditingId,
  setEditName,
  handleUpdate,
  handleDelete,
}: SortableTagItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded-xl border p-3 shadow-sm transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <div className="flex flex-1 items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300 touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {editingId === tag.id ? (
          <div className="flex flex-1 items-center gap-2 mr-4">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdate(tag.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
            <button
              onClick={() => handleUpdate(tag.id)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              儲存
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-70 dark:text-zinc-4000 dark:text-zinc-400"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex-1">
            {tag.name}
          </div>
        )}
      </div>

      {editingId !== tag.id && (
        <div className="flex items-center">
          <button
            onClick={() => {
              setEditingId(tag.id);
              setEditName(tag.name);
            }}
            className="p-2 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(tag.id)}
            className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TagsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (user) loadTags();
  }, [user]);

  const loadTags = async () => {
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
  };

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
      alert('新增失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('確定要刪除此標籤嗎？相關的交易紀錄不會被刪除，但可能會無法顯示正確標籤名稱。')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tags', id));
      setTags(tags.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
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
      alert('更新失敗');
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

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between gap-4">
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
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">新增標籤</span>
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
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
