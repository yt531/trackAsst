'use client';

import { Trash2, Edit2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Tag } from '@/types';

interface SortableTagItemProps {
  tag: Tag;
  editingId: string | null;
  editName: string;
  setEditingId: (id: string | null) => void;
  setEditName: (name: string) => void;
  handleUpdate: (id: string) => void;
  handleDelete: (id: string) => void;
  canEdit?: boolean; // 預設可編輯；共享帳本依成員權限傳入
  isReorderMode?: boolean;
}

export function SortableTagItem({
  tag,
  editingId,
  editName,
  setEditingId,
  setEditName,
  handleUpdate,
  handleDelete,
  canEdit = true,
  isReorderMode,
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
        {/* Drag Handle */}
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
