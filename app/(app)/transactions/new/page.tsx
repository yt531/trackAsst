'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentMethod, Category, Invoice, Transaction, Tag, TransactionItem } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { DatePicker } from '@/components/ui/DatePicker';
import { format } from 'date-fns';
import { Search, X, Plus, Upload, Trash2, GripVertical } from 'lucide-react';
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
import Tesseract from 'tesseract.js';
import { parseReceiptFromWords, ScannedReceiptResult, type OcrWord } from '@/lib/receipt-parser';
import { preprocessImageForOCR } from '@/lib/image-preprocess';
import { PageHeader } from '@/components/PageHeader';

interface UIItem extends TransactionItem {
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
      className={`grid grid-cols-[24px_1fr_60px_70px_32px] gap-0 border-t border-zinc-200 dark:border-zinc-700 ${
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
        className="px-3 py-2 text-sm bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
        placeholder="品名"
      />
      <input
        type="number"
        value={item.quantity || ''}
        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
        className="px-2 py-2 text-sm text-center bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
        placeholder="0"
      />
      <input
        type="number"
        value={item.subtotal || ''}
        onChange={(e) => updateItem(item.id, 'subtotal', e.target.value)}
        className="px-2 py-2 text-sm text-right bg-white dark:bg-zinc-900 outline-none border-r border-zinc-200 dark:border-zinc-700"
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

function TransactionForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId');
  const editId = searchParams.get('editId');
  const mode = searchParams.get('mode');
  const isScanMode = mode === 'scan_receipt';

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [items, setItems] = useState<UIItem[]>([]);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [scannedTransactions, setScannedTransactions] = useState<ScannedReceiptResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanWarning, setScanWarning] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [scannedPreviews, setScannedPreviews] = useState<string[]>([]);
  const [showScanSummary, setShowScanSummary] = useState(false);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [savedScanIndices, setSavedScanIndices] = useState<Set<number>>(new Set());
  
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoadingInitial(true);

    try {
      // Load Payment Methods
      const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
      const pms = pmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      
      const hasCash = pms.find(m => m.id === 'cash');
      const hasUnsetExpense = pms.find(m => m.id === 'unset_expense');
      const hasUnsetIncome = pms.find(m => m.id === 'unset_income');
      
      if (!hasCash) {
        pms.push({ id: 'cash', type: 'cash', name: '現金', isSystem: true, order: -3 } as PaymentMethod);
      }
      if (!hasUnsetExpense) {
        pms.push({ id: 'unset_expense', type: 'unset', name: '未設定支付方式', isSystem: true, order: -2 } as PaymentMethod);
      }
      if (!hasUnsetIncome) {
        pms.push({ id: 'unset_income', type: 'unset', name: '未設定收款方式', isSystem: true, order: -1 } as PaymentMethod);
      }
      
      let filteredPms = pms.filter(m => m.id !== 'unset');
      filteredPms.sort((a, b) => (a.order || 0) - (b.order || 0));
      setPaymentMethods(filteredPms);

      // Load Custom Categories
      const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      const allCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
      setCategories(allCats);

      // Load Tags
      const tagSnapshot = await getDocs(collection(db, 'users', user.uid, 'tags'));
      let userTags = tagSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
      
      userTags.sort((a, b) => {
        const orderA = a.order ?? a.createdAt;
        const orderB = b.order ?? b.createdAt;
        return orderA - orderB;
      });
      
      setTags(userTags);

      let defaultPmId = pms.find(p => p.isDefault)?.id || (pms.length > 0 ? pms[0].id : '');
      
      if (editId) {
        // Load existing transaction for editing
        const txDoc = await getDoc(doc(db, 'users', user.uid, 'transactions', editId));
        if (txDoc.exists()) {
          const txData = txDoc.data() as Transaction;
          setType(txData.type as 'income' | 'expense');
          setAmount(txData.amount.toString());
          setCurrency(txData.currency || 'TWD');
          setExchangeRate(txData.exchangeRate?.toString() || '1');
          setCategoryId(txData.categoryId);
          if (txData.paymentMethodId === 'unset') {
            setPaymentMethodId(txData.type === 'income' ? 'unset_income' : 'unset_expense');
          } else {
            setPaymentMethodId(txData.paymentMethodId || '');
          }
          setLocation(txData.location || '');
          setDate(format(new Date(txData.date), "yyyy-MM-dd'T'HH:mm"));
          // Load structured items, or convert legacy details to items
          if (txData.items && txData.items.length > 0) {
            setItems(txData.items.map(i => ({ ...i, id: crypto.randomUUID() })));
          } else if (txData.details) {
            // Backward compat: convert old details string to items
            const legacyItems = txData.details.split('\n').filter((l: string) => l.trim()).map((line: string) => ({
              id: crypto.randomUUID(),
              name: line.trim(),
              quantity: 0,
              subtotal: 0,
            }));
            setItems(legacyItems);
          }
          setNotes(txData.notes || '');
          if (txData.tagIds) {
            setSelectedTags(txData.tagIds);
          }
        }
      } else {
        // No defaults
        setCategoryId('');
        setPaymentMethodId('');

        // Load Invoice if provided
        if (invoiceId) {
          const invDoc = await getDoc(doc(db, 'users', user.uid, 'invoices', invoiceId));
          if (invDoc.exists()) {
            const invData = invDoc.data() as Invoice;
            setLinkedInvoice(invData);
            setAmount(invData.totalAmount.toString());
            setDate(format(new Date(invData.date), "yyyy-MM-dd'T'HH:mm"));
            if (invData.items && invData.items.length > 0) {
              setItems(invData.items.map(i => ({
                id: crypto.randomUUID(),
                name: i.description,
                quantity: i.quantity,
                subtotal: i.amount,
              })));
            }
            if (invData.notes) {
              setNotes(invData.notes);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInitial(false);
    }
  };

  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });
    
    const newScans: ScannedReceiptResult[] = [];
    const newPreviews: string[] = [];

    // Create preview URLs for each file
    for (let i = 0; i < files.length; i++) {
      newPreviews.push(URL.createObjectURL(files[i]));
    }
    
    try {
      // Use default chi_tra model from Tesseract.js CDN (compatible with WASM)
      // Image preprocessing + coordinate-based parsing provide the main accuracy gains
      const worker = await Tesseract.createWorker('chi_tra');
      
      for (let i = 0; i < files.length; i++) {
        setScanProgress({ current: i + 1, total: files.length });
        const file = files[i];
        
        // Preprocess image: dark mode detection, grayscale, binarization, 2x scale
        const preprocessedCanvas = await preprocessImageForOCR(file);
        
        // OCR with word-level coordinate data
        // tesseract.js v6+ no longer exposes data.words; request blocks and flatten
        const { data } = await worker.recognize(preprocessedCanvas, {}, { blocks: true });

        // Convert Tesseract.js words to our OcrWord format
        const tessWords: Tesseract.Word[] = (data.blocks || []).flatMap(b =>
          b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words))
        );
        const ocrWords: OcrWord[] = tessWords.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox,
        }));
        
        console.log('[OCR] Raw words:', ocrWords.length, 'words detected');
        
        // Parse using coordinate-based approach
        const result = parseReceiptFromWords(ocrWords);
        newScans.push(result);
      }
      
      await worker.terminate();
      
      setScannedTransactions(newScans);
      setScannedPreviews(newPreviews);
      setShowScanSummary(true);
      setCurrentScanIndex(0);
      setSavedScanIndices(new Set());
      
    } catch (err) {
      console.error('OCR Error:', err);
      alert('辨識過程發生錯誤，請稍後再試。');
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const loadScannedTransaction = (scan: ScannedReceiptResult) => {
    if (scan.totalAmount !== undefined) setAmount(scan.totalAmount.toString());
    if (scan.location) setLocation(scan.location);
    if (scan.date) setDate(scan.date);
    if (scan.items && scan.items.length > 0) {
      setItems(scan.items.map(i => ({ ...i, id: crypto.randomUUID() })));
    }
    if (scan.invoiceNumber) {
      setNotes(`發票號碼：${scan.invoiceNumber}`);
    }
    
    if (scan.incomplete && scan.errors && scan.errors.length > 0) {
      setScanWarning(`⚠️ 系統無法完整解析，請檢查並補上：${scan.errors.join('、')}`);
    } else {
      setScanWarning('');
    }
  };

  const resetFormFields = () => {
    setType('expense');
    setAmount('');
    setLocation('');
    setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setItems([]);
    setCategoryId('');
    setPaymentMethodId('');
    setSelectedTags([]);
    setNotes('');
    setScanWarning('');
  };

  // Items table helpers
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

  const jumpToScan = (idx: number) => {
    setCurrentScanIndex(idx);
    resetFormFields();
    loadScannedTransaction(scannedTransactions[idx]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) { alert('請選擇分類'); return; }
    if (!paymentMethodId) { alert(type === 'expense' ? '請選擇支付方式' : '請選擇收款方式'); return; }
    if (!user || !amount) return;
    setIsSubmitting(true);

    try {
      const numAmount = parseFloat(amount);
      const numRate = parseFloat(exchangeRate);
      const baseAmount = numAmount * numRate;

      // Build details string from items for backward compatibility
      const detailsStr = items.length > 0
        ? items.map(i => `${i.name} x${i.quantity} ${i.subtotal}`).join('\n')
        : '';
        
      const txItems = items.map(({ id, ...rest }) => rest);

      const txData = {
        userId: user.uid,
        type,
        amount: numAmount,
        baseAmount,
        currency,
        exchangeRate: numRate,
        categoryId,
        paymentMethodId,
        date: new Date(date).getTime(),
        details: detailsStr,
        items: txItems.length > 0 ? txItems : [],
        notes,
        tagIds: selectedTags,
        location,
        updatedAt: Date.now(),
      };

      if (editId) {
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editId), txData);
      } else {
        const newTxData = {
          ...txData,
          invoiceId: invoiceId || null,
          createdAt: Date.now(),
        };
        await addDoc(collection(db, 'users', user.uid, 'transactions'), newTxData);

        if (invoiceId) {
          await updateDoc(doc(db, 'users', user.uid, 'invoices', invoiceId), {
            isLinkedToTransaction: true
          });
        }
      }

      if (scannedTransactions.length > 0 && !showScanSummary) {
        const newSaved = new Set(savedScanIndices);
        newSaved.add(currentScanIndex);
        setSavedScanIndices(newSaved);

        // Find next unsaved index
        let nextIndex = -1;
        for (let i = 0; i < scannedTransactions.length; i++) {
          if (!newSaved.has(i)) {
            nextIndex = i;
            break;
          }
        }

        if (nextIndex !== -1) {
          setCurrentScanIndex(nextIndex);
          resetFormFields();
          loadScannedTransaction(scannedTransactions[nextIndex]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setIsSubmitting(false);
          return;
        } else {
          // All done - cleanup
          scannedPreviews.forEach(url => URL.revokeObjectURL(url));
          setScannedTransactions([]);
          setScannedPreviews([]);
          setScanWarning('');
          setSavedScanIndices(new Set());
          setShowScanSummary(false);
        }
      }

      router.push('/transactions');
      router.refresh();
    } catch (error) {
      console.error('Error saving transaction', error);
      alert('儲存交易失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入中...</div>;
  }

  const filteredTags = tags.filter((tag) => 
    (tag.name || '').toLowerCase().includes((tagSearchQuery || '').toLowerCase())
  );

  const filteredCategories = categories.filter(c => c.type === type).filter((cat) =>
    (cat.name || '').toLowerCase().includes((categorySearchQuery || '').toLowerCase())
  );

  const filteredPaymentMethods = paymentMethods.filter((pm) => {
    if (type === 'expense' && pm.id === 'unset_income') return false;
    if (type === 'income' && pm.id === 'unset_expense') return false;
    return (pm.name || '').toLowerCase().includes((paymentSearchQuery || '').toLowerCase());
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader 
        title={editId ? '修改交易' : '新增交易'} 
        backHref={isScanMode ? '/invoices' : undefined} 
      />
      <header className="hidden md:flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{editId ? '修改交易' : '新增交易'}</h1>
      </header>

      {!editId && isScanMode && scannedTransactions.length === 0 && (
         <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700 relative hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
               <input type="file" multiple accept="image/*" onChange={handleFileUpload} disabled={isScanning || isSubmitting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
               <div className="flex flex-col items-center justify-center gap-2">
                  <div className="rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                     <Upload className="h-6 w-6" />
                  </div>
                  {isScanning ? (
                     <div>
                        <p className="font-medium">OCR 辨識中...</p>
                        <p className="text-sm text-zinc-500">處理進度：{scanProgress.current} / {scanProgress.total}</p>
                     </div>
                  ) : (
                     <div>
                        <p className="font-medium">上傳發票明細截圖以進行辨識</p>
                        <p className="text-sm text-zinc-500">可多選，將會批次辨識</p>
                     </div>
                  )}
               </div>
            </div>
            
            {!manualEntryMode && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setManualEntryMode(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  跳過掃描，直接手動輸入
                </button>
              </div>
            )}
         </div>
      )}

      {/* Scan Results Summary */}
      {showScanSummary && scannedTransactions.length > 0 && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm font-medium text-center">
              共 <span className="font-bold">{scannedTransactions.length}</span> 筆，
              <span className="text-green-600 dark:text-green-400">
                {scannedTransactions.filter(s => !s.incomplete).length} 筆辨識完整 ✅
              </span>
              {scannedTransactions.filter(s => s.incomplete).length > 0 && (
                <>
                  ，
                  <span className="text-amber-600 dark:text-amber-400">
                    {scannedTransactions.filter(s => s.incomplete).length} 筆需補充 ⚠️
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {scannedTransactions.map((scan, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-4 transition-colors ${
                  scan.incomplete
                    ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10'
                    : 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10'
                }`}
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {scannedPreviews[idx] && (
                    <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <img
                        src={scannedPreviews[idx]}
                        alt={`截圖 ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        明細 {idx + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          scan.incomplete
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {scan.incomplete ? '⚠️ 需補充' : '✅ 完整'}
                      </span>
                    </div>

                    {/* Recognized fields */}
                    <div className="space-y-1 text-sm">
                      {scan.totalAmount !== undefined && (
                        <p className="text-base font-semibold">${scan.totalAmount}</p>
                      )}
                      {scan.location && (
                        <p className="truncate text-zinc-600 dark:text-zinc-300">
                          📍 {scan.location}
                        </p>
                      )}
                      {scan.date && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          🗓️ {scan.date.replace('T', ' ').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3')}
                        </p>
                      )}
                      {scan.items && scan.items.length > 0 && (
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          🛒 {scan.items[0].name}{scan.items.length > 1 ? ` 等 ${scan.items.length} 項` : ''}
                        </p>
                      )}
                    </div>

                    {/* Missing fields warning */}
                    {scan.incomplete && scan.errors && scan.errors.length > 0 && (
                      <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                        請補上「{scan.errors.join('」、「')}」
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Start editing button */}
          <button
            type="button"
            onClick={() => {
              setShowScanSummary(false);
              jumpToScan(0);
            }}
            className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white transition-colors hover:bg-blue-700"
          >
            開始編輯（共 {scannedTransactions.length} 筆）
          </button>
        </div>
      )}

      {scanWarning && (
        <div className="rounded-xl bg-yellow-50 p-4 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
           <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{scanWarning}</p>
        </div>
      )}

      {linkedInvoice && (
        <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            已連結發票：{linkedInvoice.id}
          </p>
        </div>
      )}

      {/* Progress Indicator for batch editing */}
      {scannedTransactions.length > 0 && !showScanSummary && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              第 {currentScanIndex + 1} / {scannedTransactions.length} 筆
            </span>
            <button
              type="button"
              onClick={() => setShowScanSummary(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              回到總覽
            </button>
          </div>
          <div className="flex gap-1.5">
            {scannedTransactions.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (idx !== currentScanIndex && !savedScanIndices.has(idx)) {
                    jumpToScan(idx);
                  }
                }}
                className={`h-2 flex-1 rounded-full transition-all ${
                  savedScanIndices.has(idx)
                    ? 'bg-green-500 dark:bg-green-400'
                    : idx === currentScanIndex
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-600 dark:hover:bg-zinc-500 cursor-pointer'
                }`}
                title={`第 ${idx + 1} 筆${savedScanIndices.has(idx) ? '（已儲存）' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {(!isScanMode || editId || (scannedTransactions.length > 0 && !showScanSummary) || manualEntryMode) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        {!isScanMode && !invoiceId && mode !== 'scan' && (
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                type === 'expense'
                  ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'
              }`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                type === 'income'
                  ? 'bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-90 dark:text-zinc-4000 dark:text-zinc-400'
              }`}
            >
              收入
            </button>
          </div>
        )}

        {/* Amount & Currency */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">金額</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-lg font-bold dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="0.00"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-sm font-medium">幣別</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 h-[52px]"
            >
              <option value="TWD">TWD</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {currency !== 'TWD' && (
          <div>
            <label className="mb-1 block text-sm font-medium">匯率 (轉為基準貨幣)</label>
            <input
              type="number"
              step="0.000001"
              required
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {amount && exchangeRate ? `≈ ${(parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2)} TWD` : ''}
            </p>
          </div>
        )}

        {/* Category & Payment Method */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">分類</label>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white p-3 text-sm text-left dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className={!categoryId ? "text-zinc-500 dark:text-zinc-400" : "truncate"}>
                {categoryId ? categories.find(c => c.id === categoryId)?.name || '未知分類' : '選擇分類'}
              </span>
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {type === 'expense' ? '支付方式' : '收款方式'}
            </label>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white p-3 text-sm text-left dark:border-zinc-700 dark:bg-zinc-900"
            >
              <span className={!paymentMethodId ? "text-zinc-500 dark:text-zinc-400" : "truncate"}>
                {paymentMethodId ? paymentMethods.find(p => p.id === paymentMethodId)?.name || (type === 'expense' ? '未知支付方式' : '未知收款方式') : (type === 'expense' ? '選擇支付方式' : '選擇收款方式')}
              </span>
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium">日期</label>
          <DatePicker
            type="datetime-local"
            required
            value={date}
            onChange={(val) => setDate(val)}
          />
        </div>

        {/* Location */}
        {type === 'expense' && (
          <div>
            <label className="mb-1 block text-sm font-medium">交易地點</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-[11px] text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="例如：超商、超市、賣場、商店..."
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm font-medium">標籤</label>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tagId) => {
              const tag = tags.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTags(selectedTags.filter(id => id !== tag.id))}
                    className="ml-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setIsTagModalOpen(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <Plus className="h-3 w-3" />
              新增標籤
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div>
          <label className="mb-1 block text-sm font-medium">交易明細</label>
          {items.length > 0 ? (
            <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[24px_1fr_60px_70px_32px] gap-0 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field-sizing-content w-full min-h-[60px] rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="新增個人備註..."
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-600 p-4 text-center font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '儲存中...' : (
            editId ? '儲存修改' :
            (scannedTransactions.length > 0 && !showScanSummary) ? (
              scannedTransactions.length - savedScanIndices.size <= 1 ? '儲存最後一筆' : '儲存，下一筆 →'
            ) : '儲存交易'
          )}
        </button>
      </form>
        </div>
      )}

      {/* Tags Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇標籤</h2>
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋標籤..."
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {tags.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                  目前沒有任何標籤。<br/>請至設定頁面新增標籤。
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">找不到符合的標籤。</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                          } else {
                            setSelectedTags([...selectedTags, tag.id]);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{tag.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">選擇分類</h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋分類..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {filteredCategories.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">找不到符合的分類。</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredCategories.map((cat) => {
                    const isSelected = categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(cat.id);
                          setIsCategoryModalOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{cat.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">{type === 'expense' ? '選擇支付方式' : '選擇收款方式'}</h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder={type === 'expense' ? '搜尋支付方式...' : '搜尋收款方式...'}
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
              {filteredPaymentMethods.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                  {type === 'expense' ? '找不到符合的支付方式。' : '找不到符合的收款方式。'}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredPaymentMethods.map((pm) => {
                    const isSelected = paymentMethodId === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethodId(pm.id);
                          setIsPaymentModalOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-medium text-sm">{pm.name}</span>
                        {isSelected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">載入表單中...</div>}>
      <TransactionForm />
    </Suspense>
  );
}
