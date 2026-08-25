'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { getLedgerTags, createLedgerTag, updateLedgerTag, deleteLedgerTag, getLedgerMembers } from '@/lib/ledger';
import { Tag } from '@/types';
import { Plus, Trash2, ArrowLeft, Tags as TagsIcon, Edit2, GripVertical, Search, ArrowUpDown } from 'lucide-react';
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

interface SortableTagItemProps {
  tag: Tag;
  editingId: string | null;
  editName: string;
  setEditingId: (id: string | null) => void;
  setEditName: (name: string) => void;
  handleUpdate: (id: string) => void;
  handleDelete: (id: string) => void;
  canEdit: boolean;
  isReorderMode?: boolean;
}

function SortableTagItem({
  tag,
  editingId,
  editName,
  setEditingId,
  setEditName,
  handleUpdate,
  handleDelete,
  canEdit,
  isReorderMode
}: SortableTagItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id, disabled: !canEdit });

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
          : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
      }`}
    >
      <div className="flex flex-1 items-center gap-3">
        {canEdit && isReorderMode && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
        )}

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

      {editingId !== tag.id && canEdit && (
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

export default function SharedTagsPage() {
  const { user } = useAuth();
  const { activeLedger, activeLedgerId } = useLedger();
  const router = useRouter();
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
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
      const data = await getLedgerTags(activeLedgerId);
      
      data.sort((a, b) => {
        const orderA = a.order ?? a.createdAt;
        const orderB = b.order ?? b.createdAt;
        return orderA - orderB;
      });
      
      setTags(data);
      
      const members = await getLedgerMembers(activeLedgerId);
      const currentUserMember = members.find(m => m.userId === user.uid);
      
      let hasPerm = false;
      if (currentUserMember?.role === 'admin') {
        hasPerm = true;
      } else if (currentUserMember?.role === 'editor' && activeLedger?.settings?.allowMembersToCreateTags) {
        hasPerm = true;
      }
      setCanEdit(hasPerm);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeLedgerId || !name || !canEdit) return;
    setIsSaving(true);
    
    try {
      const maxOrder = tags.length > 0 ? Math.max(...tags.map(t => t.order ?? 0)) : 0;
      const newOrder = maxOrder + 1;

      const newTagId = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newTag: Tag = {
        id: newTagId,
        ledgerId: activeLedgerId,
        name,
        userId: user.uid,
        order: newOrder,
        createdAt: Date.now(),
        createdBy: user.uid
      };
      
      await createLedgerTag(activeLedgerId, newTag);
      setTags([...tags, newTag]);
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
    if (!user || !activeLedgerId || !canEdit || !confirm('確定要刪除此標籤嗎？')) return;
    try {
      await deleteLedgerTag(activeLedgerId, id);
      setTags(tags.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
      alert('刪除失敗');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!user || !activeLedgerId || !canEdit || !editName.trim()) return;
    try {
      await updateLedgerTag(activeLedgerId, id, { name: editName.trim() });
      setTags(tags.map(t => t.id === id ? { ...t, name: editName.trim() } : t));
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('更新失敗');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEdit || !activeLedgerId) return;
    const { active, over } = event;
    if (!over || !user || active.id === over.id) return;

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);

    const newTags = arrayMove(tags, oldIndex, newIndex);
    setTags(newTags);

    try {
      const promises = newTags.map((tag, index) => {
        if (tag.order !== index) {
          tag.order = index;
          return updateLedgerTag(activeLedgerId, tag.id, { order: index });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (e) {
      console.error('Error saving tag order:', e);
    }
  };

  const filteredTags = tags.filter((tag) => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader 
        title="帳本標籤管理" 
        backHref={`/ledgers/detail/settings?id=${activeLedgerId}`} 
        rightAction={
          canEdit ? (
            <button
              onClick={() => setIsAdding(!isAdding)}
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
            <h1 className="text-2xl font-bold tracking-tight">帳本標籤管理</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              管理 {activeLedger?.name} 的標籤
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tags.length > 1 && (
            <button
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`flex items-center gap-1 text-sm font-medium rounded-lg px-3 py-2 transition-colors ${
                isReorderMode
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="hidden sm:inline">排序</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">新增標籤</span>
            </button>
          )}
        </div>
      </header>

      {!canEdit && !loading && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/30 dark:bg-yellow-900/10 dark:text-yellow-200">
          您目前的權限無法編輯此帳本的標籤。
        </div>
      )}

      {isAdding && canEdit && (
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
              <div className="text-sm text-zinc-500 dark:text-zinc-400 py-4">目前沒有任何標籤。{canEdit ? '點擊上方「新增標籤」來建立。' : ''}</div>
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
                          canEdit={canEdit}
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
