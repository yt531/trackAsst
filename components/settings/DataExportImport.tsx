import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { Download, Upload } from 'lucide-react';
import { Transaction } from '@/types';
import { format } from 'date-fns';

export function DataExportImport() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const q = collection(db, 'users', user.uid, 'transactions');
      const snap = await getDocs(q);

      const rows = [
        ['Date', 'Type', 'Amount', 'Currency', 'BaseAmountTWD', 'Category', 'PaymentMethod', 'Notes'].join(',')
      ];

      snap.docs.forEach(doc => {
        const d = doc.data() as Transaction;
        const dateStr = format(new Date(d.date), 'yyyy-MM-dd HH:mm:ss');
        const notes = d.notes ? `"${d.notes.replace(/"/g, '""')}"` : '';
        rows.push([dateStr, d.type, d.amount, d.currency, d.baseAmount, d.categoryId, d.paymentMethodId, notes].join(','));
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.join('\n'); // Add BOM for Excel
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `fintrack_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Data Management</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Export Data (CSV)</div>
            <div className="text-sm text-zinc-500">Download all your transactions as a CSV file.</div>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 my-2"></div>

        <div className="flex items-center justify-between opacity-50 cursor-not-allowed" title="Coming in future update">
          <div>
            <div className="font-medium">Import Data (CSV)</div>
            <div className="text-sm text-zinc-500">Import transactions from a CSV file.</div>
          </div>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium dark:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
        </div>

      </div>
    </div>
  );
}
