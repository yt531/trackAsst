'use client';

import { useState } from 'react';
import { QRScanner } from '@/components/QRScanner';
import { Receipt, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { parseInvoiceQRCode } from '@/lib/invoice';
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

  const handleScan = (data: string) => {
    if (!isActive) return;
    
    try {
      const parsed = parseInvoiceQRCode(data);
      setIsActive(false);
      setScannedData(data);
      setInvoiceDetails(parsed);
    } catch (e) {
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
      alert('Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Scan Invoice</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Scan the QR code on your electronic paper invoice.
        </p>
      </header>

      {isActive ? (
        <QRScanner onScan={handleScan} isActive={isActive} />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Invoice Scanned</h2>
            <p className="mt-1 text-sm text-zinc-500">
              We successfully read the invoice details.
            </p>
            
            {invoiceDetails && (
              <div className="mt-6 w-full rounded-lg bg-zinc-50 p-4 text-left dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div>
                    <div className="text-zinc-500">Invoice Number</div>
                    <div className="font-medium font-mono">{invoiceDetails.number}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Total Amount</div>
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                      NT$ {invoiceDetails.totalAmount}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Date (ROC)</div>
                    <div className="font-medium">{invoiceDetails.dateStr}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Seller ID</div>
                    <div className="font-medium">{invoiceDetails.sellerId}</div>
                  </div>
                </div>

                {invoiceDetails.items.length > 0 && (
                   <div>
                     <div className="text-zinc-500 mb-2 font-medium">Items</div>
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
                Scan Another
              </button>
              <button
                onClick={handleSaveToPassbook}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save to Passbook'}
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
          <h3 className="text-lg font-semibold">Record Transaction?</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Invoice saved to passbook. Would you like to record this as an expense right now?
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => router.push(`/transactions/new?invoiceId=${savedInvoiceId}`)}
              className="rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Yes, record expense
            </button>
            <button
              onClick={() => {
                setShowPrompt(false);
                router.push('/invoices');
              }}
              className="rounded-lg border border-zinc-200 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              No, just go to passbook
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
