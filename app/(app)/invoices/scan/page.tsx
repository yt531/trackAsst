'use client';

import { useState } from 'react';
import { QRScanner } from '@/components/QRScanner';
import { Receipt, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function InvoiceScanPage() {
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [isActive, setIsActive] = useState(true);

  const handleScan = (data: string) => {
    if (!isActive) return;
    
    // Left QR code usually contains the core 77 characters info
    // Format: 10 chars (Invoice Num) + 7 chars (Date) + 4 chars (Random) + 8 chars (Sales hex) + 8 chars (Total hex) + etc...
    if (data && data.length >= 77 && /^[A-Z]{2}[0-9]{8}/.test(data)) {
      setIsActive(false);
      setScannedData(data);
      
      try {
        const invNum = data.substring(0, 10);
        const dateStr = data.substring(10, 17); // e.g., 1120512
        const randomCode = data.substring(17, 21);
        const salesHex = data.substring(21, 29);
        const totalHex = data.substring(29, 37);
        const sellerId = data.substring(45, 53);
        
        const totalAmount = parseInt(totalHex, 16);
        
        setInvoiceDetails({
          number: invNum,
          date: dateStr,
          total: totalAmount,
          seller: sellerId
        });
      } catch (e) {
        console.error("Failed to parse invoice", e);
      }
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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500">Invoice Number</div>
                    <div className="font-medium font-mono">{invoiceDetails.number}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Total Amount</div>
                    <div className="font-medium text-blue-600 dark:text-blue-400">
                      NT$ {invoiceDetails.total}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Date (ROC)</div>
                    <div className="font-medium">{invoiceDetails.date}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Seller ID</div>
                    <div className="font-medium">{invoiceDetails.seller}</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <button 
                onClick={() => {
                  setScannedData(null);
                  setInvoiceDetails(null);
                  setIsActive(true);
                }}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                Scan Another
              </button>
              <button className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
                Save to Passbook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
