import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { PaymentMethod, PaymentMethodType } from '@/types';
import { Plus, CreditCard, Landmark, Smartphone, Trash2 } from 'lucide-react';
import { PREDEFINED_BANKS, PREDEFINED_EPAYS, PREDEFINED_CARDS } from '@/lib/constants';

export function PaymentMethodsManager() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [type, setType] = useState<PaymentMethodType>('bank');
  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) {
      loadMethods();
    }
  }, [user]);

  const loadMethods = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'paymentMethods'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      setMethods(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;

    try {
      const newMethod = {
        type,
        brandId,
        name,
        notes,
        isDefault: methods.length === 0
      };

      const docRef = await addDoc(collection(db, 'users', user.uid, 'paymentMethods'), newMethod);
      setMethods([...methods, { id: docRef.id, ...newMethod }]);
      setIsAdding(false);
      setName('');
      setNotes('');
      setBrandId('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'paymentMethods', id));
      setMethods(methods.filter(m => m.id !== id));
    } catch (e) {
      console.error(e);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payment Methods</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {[
                { id: 'bank', icon: Landmark, label: 'Bank' },
                { id: 'epay', icon: Smartphone, label: 'E-Pay' },
                { id: 'card', icon: CreditCard, label: 'Card' }
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
                      : 'border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Brand (Optional)</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Custom (No predefined icon)</option>
              {getBrandList().map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Savings Account"
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading...</div>
      ) : methods.length === 0 ? (
        <div className="text-sm text-zinc-500">No payment methods added yet.</div>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <div key={method.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                  {method.type === 'bank' && <Landmark className="h-5 w-5 text-zinc-500" />}
                  {method.type === 'epay' && <Smartphone className="h-5 w-5 text-zinc-500" />}
                  {method.type === 'card' && <CreditCard className="h-5 w-5 text-zinc-500" />}
                  {method.type === 'cash' && <span className="text-lg">💵</span>}
                </div>
                <div>
                  <div className="font-medium text-sm">{method.name}</div>
                  {method.notes && <div className="text-xs text-zinc-500">{method.notes}</div>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(method.id)}
                className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
