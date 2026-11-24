'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TransactionItem } from '@/types';

export interface UIItem extends TransactionItem {
  id: string;
}

function SortableItem({
  item,
  updateItem,
  removeItem
}: {
  item: UIItem;
  updateItem: (id: string, field: keyof TransactionItem, value: string | number) => void;
  removeItem: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[24px_minmax(0,1fr)_minmax(36px,50px)_minmax(44px,62px)_28px] gap-0 border-t border-zinc-200 dark:border-zinc-700 ${
        isDragging ? 'bg-zinc-100 dark:bg-zinc-800 shadow-md relative z-10' : ''
      }`}
    >
      <div
        className="flex items-center justify-center cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={item.name}
        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
        className="min-w-0 px-3 py-2 text-sm bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
        placeholder="品名"
      />
      <input
        type="number"
        value={item.quantity || ''}
        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
        className="min-w-0 px-2 py-2 text-sm text-center bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
        placeholder="0"
      />
      <input
        type="number"
        value={item.subtotal || ''}
        onChange={(e) => updateItem(item.id, 'subtotal', e.target.value)}
        className="min-w-0 px-2 py-2 text-sm text-right bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
        placeholder="0"
      />
      <button
        type="button"
        onClick={() => removeItem(item.id)}
        className="flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors bg-zinc-50/50 dark:bg-zinc-800/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// 交易明細表格（可新增、刪除、拖曳排序）；品項狀態由父層持有，這裡只負責編輯
export function ItemsTable({
  items,
  setItems
}: {
  items: UIItem[];
  setItems: Dispatch<SetStateAction<UIItem[]>>;
}) {
  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), name: '', quantity: 1, subtotal: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: string | number) => {
    setItems(items.map((item) => {
      if (item.id !== id) return item;
      if (field === 'name') return { ...item, name: value as string };
      if (field === 'quantity') return { ...item, quantity: Number(value) || 0 };
      if (field === 'subtotal') return { ...item, subtotal: Number(value) || 0 };
      return item;
    }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px drag to trigger, helps prevent accidental drags on clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">交易明細</label>
      {items.length > 0 ? (
        <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[24px_minmax(0,1fr)_minmax(36px,50px)_minmax(44px,62px)_28px] gap-0 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <div className="px-1 py-2 border-r border-zinc-200 dark:border-zinc-700"></div>
            <div className="px-3 py-2 text-center border-r border-zinc-200 dark:border-zinc-700">品名</div>
            <div className="px-2 py-2 text-center border-r border-zinc-200 dark:border-zinc-700">數量</div>
            <div className="px-2 py-2 text-center border-r border-zinc-200 dark:border-zinc-700">小計</div>
            <div className="px-1 py-2"></div>
          </div>
          {/* Table Rows (Sortable) */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  updateItem={updateItem}
                  removeItem={removeItem}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
      <button
        type="button"
        onClick={addItem}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <Plus className="h-3 w-3" />
        新增品項
      </button>
    </div>
  );
}
