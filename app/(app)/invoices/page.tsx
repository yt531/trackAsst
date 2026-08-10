'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Invoice } from '@/types';
import Link from 'next/link';
import { ScanLine, Receipt, Settings2, Cloud, FileText, ChevronLeft, ChevronRight, Calendar, ArrowDownRight, Hash, Trash2, Edit2, Check, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/dialog';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cloud' | 'paper'>('cloud');
  
  const [filterMode, setFilterMode] = useState<'month' | 'day'>('month');
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [totals, setTotals] = useState({ expense: 0, count: 0 });
  
  // Invoice Details Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user, filterMode, filterDate, activeTab]);

  const loadInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = filterMode === 'month' ? startOfMonth(filterDate).getTime() : startOfDay(filterDate).getTime();
      const end = filterMode === 'month' ? endOfMonth(filterDate).getTime() : endOfDay(filterDate).getTime();

      const q = query(
        collection(db, 'users', user.uid, 'invoices'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      
      const filteredData = data.filter(inv => inv.type === activeTab);
      
      let exp = 0;
      filteredData.forEach(inv => {
        exp += inv.totalAmount;
      });

      setTotals({ expense: exp, count: filteredData.length });
      setInvoices(filteredData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setFilterDate(prev => filterMode === 'month' ? subMonths(prev, 1) : subDays(prev, 1));
  };

  const handleNext = () => {
    setFilterDate(prev => filterMode === 'month' ? addMonths(prev, 1) : addDays(prev, 1));
  };

  const openInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setEditNotes(inv.notes || '');
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!user || !selectedInvoice || !confirm('確定要刪除這筆發票嗎？')) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'invoices', selectedInvoice.id));
      setInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
      setSelectedInvoice(null);
    } catch (e) {
      console.error('Failed to delete invoice', e);
      alert('刪除失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!user || !selectedInvoice) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'invoices', selectedInvoice.id), {
        notes: editNotes
      });
      setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? { ...inv, notes: editNotes } : inv));
      setSelectedInvoice({ ...selectedInvoice, notes: editNotes });
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to update invoice notes', e);
      alert('更新失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">發票存摺</h1>
        </div>
        <Link
          href="/invoices/scan"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">掃描發票</span>
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          onClick={() => setActiveTab('cloud')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'cloud'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Cloud className="h-4 w-4" />
          雲端發票
        </button>
        <button
          onClick={() => setActiveTab('paper')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'paper'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          紙本掃描
        </button>
      </div>

      {/* Filter and Stats Area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
        <div className="flex flex-col items-center justify-center gap-4 mb-4">
           {/* Mode Switcher */}
           <div className="flex w-full sm:w-64 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
             <button
               onClick={() => setFilterMode('month')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'month' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'}`}
             >
               按月
             </button>
             <button
               onClick={() => setFilterMode('day')}
               className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'day' ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'}`}
             >
               按日
             </button>
           </div>
           
           {/* Date Selector */}
           <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
             <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronLeft className="w-5 h-5" /></button>
             <DatePicker
               type={filterMode === 'month' ? 'month' : 'date'}
               value={filterMode === 'month' ? format(filterDate, 'yyyy-MM') : format(filterDate, 'yyyy-MM-dd')}
               onChange={(val) => setFilterDate(val ? new Date(val) : new Date())}
               className="w-32 sm:w-48"
               showTodayButton={false}
             />
             <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><ChevronRight className="w-5 h-5" /></button>
             <button
               onClick={() => setFilterDate(new Date())}
               className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-[10px] text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
             >
               {filterMode === 'month' ? '本月' : '今天'}
             </button>
           </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> 總支出</div>
            <div className="text-lg font-semibold mt-1">NT$ {totals.expense.toLocaleString()}</div>
          </div>
          <div>
             <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Hash className="w-3 h-3 text-blue-500" /> 發票張數</div>
            <div className="text-lg font-semibold mt-1">{totals.count} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">張</span></div>
          </div>
        </div>
      </div>

      {activeTab === 'cloud' && (
        <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
          <Cloud className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <h3 className="text-lg font-medium">敬請期待</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            未來將整合財政部電子發票 API 載入雲端發票。
          </p>
        </div>
      )}

      {activeTab === 'paper' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">載入中...</div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 border-dashed p-12 text-center dark:border-zinc-800">
              <Receipt className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <h3 className="text-lg font-medium">此期間尚無發票紀錄</h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                掃描您的紙本電子發票以在此處追蹤它們。
              </p>
              <Link
                href="/invoices/scan"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                立即掃描發票 &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {invoices.map((inv) => (
                <div 
                  key={inv.id} 
                  onClick={() => openInvoice(inv)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{format(new Date(inv.date), 'yyyy/MM/dd')}</div>
                      <div className="font-mono text-sm font-medium mt-1">{inv.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-600 dark:text-blue-400">NT$ {inv.totalAmount}</div>
                      {inv.isLinkedToTransaction ? (
                        <span className="text-[10px] uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">已記帳</span>
                      ) : (
                        <Link href={`/transactions/new?invoiceId=${inv.id}`} className="text-[10px] uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded-full">前往記帳</Link>
                      )}
                    </div>
                  </div>
                  {inv.notes && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-medium">備註：</span>{inv.notes}
                      </div>
                    </div>
                  )}
                  {inv.items && inv.items.length > 0 && !inv.notes && (
                    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {inv.items.map(i => i.description).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        {selectedInvoice && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-lg font-bold">發票明細</h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">發票號碼</div>
                  <div className="font-mono font-medium">{selectedInvoice.id}</div>
                </div>
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">日期</div>
                  <div className="font-medium">{format(new Date(selectedInvoice.date), 'yyyy/MM/dd')}</div>
                </div>
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">總金額</div>
                  <div className="font-medium text-blue-600 dark:text-blue-400">NT$ {selectedInvoice.totalAmount}</div>
                </div>
                <div>
                  <div className="text-zinc-500 dark:text-zinc-400">賣方統編</div>
                  <div className="font-medium">{selectedInvoice.sellerId || '-'}</div>
                </div>
              </div>
              
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">消費明細 (備註)</h3>
                  {!isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    >
                      <Edit2 className="h-3 w-3" /> 編輯備註
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full min-h-[100px] rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 field-sizing-content"
                      placeholder="新增發票備註或修改明細..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setIsEditing(false); setEditNotes(selectedInvoice.notes || ''); }}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        disabled={isSaving}
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleSaveNotes}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={isSaving}
                      >
                        <Check className="h-4 w-4" /> {isSaving ? '儲存中...' : '儲存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                    {selectedInvoice.notes ? (
                      <div className="whitespace-pre-wrap">{selectedInvoice.notes}</div>
                    ) : selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedInvoice.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between gap-4">
                            <span className="truncate">{item.description} {item.quantity > 1 ? `x${item.quantity}` : ''}</span>
                            {item.amount > 0 && <span className="shrink-0 text-zinc-500">NT$ {item.amount}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-zinc-500 italic">無明細資料</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除發票
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
