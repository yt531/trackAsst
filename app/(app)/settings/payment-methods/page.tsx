'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { PaymentMethod, PaymentMethodType } from '@/types';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { PREDEFINED_BANKS, PREDEFINED_EPAYS, PREDEFINED_CARDS } from '@/lib/constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PaymentMethodsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [originalMethods, setOriginalMethods] = useState<PaymentMethod[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      setOriginalMethods(data);
      setMethods(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const newMethod: PaymentMethod = {
      id: `temp-${Date.now()}`, // Temporary ID
      type,
      brandId,
      name,
      notes,
      isDefault: methods.length === 0,
    };
    setMethods([...methods, newMethod]);
    setIsAdding(false);
    setName('');
    setNotes('');
    setBrandId('');
  };

  const handleDeleteLocal = (id: string) => {
    setMethods(methods.filter(m => m.id !== id));
  };

  const hasChanges = JSON.stringify(originalMethods) !== JSON.stringify(methods);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Find deletions
      const deleted = originalMethods.filter(om => !methods.find(m => m.id === om.id));
      for (const d of deleted) {
        await deleteDoc(doc(db, 'users', user.uid, 'paymentMethods', d.id));
      }

      // Find additions (have 'temp-' prefix)
      const added = methods.filter(m => m.id.startsWith('temp-'));
      for (const a of added) {
        const { id, ...data } = a; // omit temp id
        await addDoc(collection(db, 'users', user.uid, 'paymentMethods'), data);
      }

      // Re-fetch to get real IDs
      await loadMethods();
      alert('儲存成功');
      router.push('/settings');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('尚有未儲存的修改，確定要放棄修改並返回嗎？')) {
        router.push('/settings');
      }
    } else {
      router.push('/settings');
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

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <button onClick={handleCancel} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">支付方式管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            管理您的銀行、電子支付與信用卡。
          </p>
        </div>
      </header>

      <div className="space-y-4 pb-20">
        <div className="flex justify-end">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            <Plus className="h-4 w-4" />
            新增
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddLocal} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
              <button type="submit" className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                加入清單
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                取消新增
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-zinc-500 text-center py-4">載入中...</div>
        ) : methods.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            尚未新增支付方式。
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xl">
                    {method.type === 'bank' && '🏦'}
                    {method.type === 'epay' && '📱'}
                    {method.type === 'card' && '💳'}
                    {method.type === 'cash' && '💵'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{method.name}</div>
                    {method.notes && <div className="text-xs text-zinc-500">{method.notes}</div>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteLocal(method.id)}
                  className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 md:pl-64 flex gap-3 z-50">
        <button
          onClick={handleCancel}
          className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`flex-1 rounded-xl py-3 text-sm font-medium text-white transition-colors ${
            hasChanges && !isSaving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-400 cursor-not-allowed dark:bg-blue-800'
          }`}
        >
          {isSaving ? '儲存中...' : '儲存變更'}
        </button>
      </div>
    </div>
  );
}
