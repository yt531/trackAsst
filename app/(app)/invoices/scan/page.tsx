'use client';

import { useState } from 'react';
import { QRScanner } from '@/components/QRScanner';
import { Receipt, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { parseInvoiceQRCode, parseRightQRCode } from '@/lib/invoice';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';

export default function InvoiceScanPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [scannedData, setScannedData] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showPrompt, setShowPrompt] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = (data: string, isUpload?: boolean) => {
    if (!isActive) return;
    
    const trimmedData = data.trim();
    
    // Check if it's the right-side QR Code
    if (trimmedData.startsWith('**')) {
      try {
        const extraItems = parseRightQRCode(trimmedData);
        if (invoiceDetails) {
          // Merge items into existing invoice details
          setInvoiceDetails((prev: any) => ({
            ...prev,
            items: [...prev.items, ...extraItems]
          }));
          setIsActive(false); // Done
          setScanError(null);
        } else {
          setScanError('請先掃描發票左側的 QR 碼。');
        }
      } catch (e) {
        console.warn('Right QR scan parsing failed:', e);
        if (isUpload) setScanError('右側 QR 碼解析失敗。');
      }
      return;
    }

    // Otherwise, parse as left-side QR Code
    try {
      const parsed = parseInvoiceQRCode(trimmedData);
      setScannedData(trimmedData);
      setInvoiceDetails(parsed);
      setScanError(null);
      
      // If the left QR code indicates there should be items, but none are found in the left QR code,
      // it means they are in the right QR code. We should keep scanning active.
      if (parsed.totalItemsExpected > 0 && parsed.items.length === 0) {
        setScanError('已讀取發票主資訊，請繼續掃描右側的 QR 碼以取得消費明細。');
        // Do not set isActive to false, wait for the right QR code
      } else {
        setIsActive(false);
      }
    } catch (e) {
      console.warn('QR scan parsing failed:', e, 'Raw data:', data);
      if (isUpload) {
        const preview = data.length > 30 ? data.substring(0, 30) + '...' : data;
        setScanError(`無法解析發票資訊，掃描內容：[${preview}]。請確認這是發票左側的 QR 碼。`);
      }
      // Not an invoice QR or partial scan (wait for next frame)
    }
  };

  const handleSaveToPassbook = async () => {
    if (!user || !invoiceDetails) return;
    setIsSaving(true);

    try {
      const invoiceDoc = {
        userId: user.uid,
        type: 'paper',
        date: invoiceDetails.date,
        sellerId: invoiceDetails.sellerId,
        totalAmount: invoiceDetails.totalAmount,
        randomNumber: invoiceDetails.randomNumber,
        items: invoiceDetails.items,
        isLinkedToTransaction: false,
        createdAt: Date.now()
      };

      // Use invoice number as doc ID to prevent duplicates easily
      await setDoc(doc(db, 'users', user.uid, 'invoices', invoiceDetails.number), invoiceDoc);
      setSavedInvoiceId(invoiceDetails.number);

      // Check user settings if we should prompt (mocking it as always true for now)
      setShowPrompt(true);
      
    } catch (e) {
      console.error(e);
      alert('發票儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">掃描發票</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          掃描電子發票證明聯上的 QR 碼。
        </p>
      </header>

      {scanError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {scanError}
        </div>
      )}

      {isActive ? (
        <QRScanner onScan={handleScan} isActive={isActive} />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">掃描成功</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              已成功讀取發票資訊。
            </p>
            
            {invoiceDetails && (
              <div className="mt-6 w-full rounded-lg bg-zinc-50 p-4 text-left dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">發票號碼</div>
                    <div className="font-medium font-mono">{invoiceDetails.number}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">總金額</div>
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                      NT$ {invoiceDetails.totalAmount}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">發票日期</div>
                    <div className="font-medium">{invoiceDetails.dateStr}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">賣方統編</div>
                    <div className="font-medium">{invoiceDetails.sellerId}</div>
                  </div>
                </div>

                {invoiceDetails.items.length > 0 && (
                   <div>
                     <div className="text-zinc-500 dark:text-zinc-400 mb-2 font-medium">消費明細</div>
                     <ul className="space-y-2">
                       {invoiceDetails.items.map((item: any, idx: number) => (
                         <li key={idx} className="flex justify-between text-sm">
                           <span>{item.description} x{item.quantity}</span>
                           <span>${item.amount}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                )}
              </div>
            )}
            
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <button 
                onClick={() => {
                  setScannedData(null);
                  setInvoiceDetails(null);
                  setIsActive(true);
                }}
                disabled={isSaving}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                繼續掃描
              </button>
              <button
                onClick={handleSaveToPassbook}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? '儲存中...' : '存入發票存摺'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold">要記帳嗎？</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            發票已存入存摺。您現在要將這筆發票記錄為支出嗎？
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => router.push(`/transactions/new?invoiceId=${savedInvoiceId}`)}
              className="rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              是的，立即記帳
            </button>
            <button
              onClick={() => {
                setShowPrompt(false);
                router.push('/invoices');
              }}
              className="rounded-lg border border-zinc-200 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              不用，前往發票存摺
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
