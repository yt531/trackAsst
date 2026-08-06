import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Download, Upload } from 'lucide-react';
import { Transaction, Category, PaymentMethod } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { mergeCategories } from '@/lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { DatePicker } from '@/components/ui/DatePicker';

export function DataExportImport() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const q = collection(db, 'users', user.uid, 'transactions');
      const snap = await getDocs(q);

      // 取得分類資料
      const catSnap = await getDocs(collection(db, 'users', user.uid, 'categories'));
      const customCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      const allCats = mergeCategories(DEFAULT_CATEGORIES, customCats);
      const catMap = new Map(allCats.map(c => [c.id, c.name]));

      // 取得支付方式資料
      const pmSnapshot = await getDocs(collection(db, 'users', user.uid, 'paymentMethods'));
      const pms = pmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      const pmMap = new Map(pms.map(p => [p.id, p.name]));
      pmMap.set('cash', '現金');
      pmMap.set('unset', '未設定支付方式');

      let transactions = snap.docs.map(doc => doc.data() as Transaction);

      if (startDate) {
        const startObj = new Date(`${startDate}T00:00:00`);
        transactions = transactions.filter(t => new Date(t.date) >= startObj);
      }
      if (endDate) {
        const endObj = new Date(`${endDate}T23:59:59`);
        transactions = transactions.filter(t => new Date(t.date) <= endObj);
      }

      if (transactions.length === 0) {
        alert('在此日期範圍內沒有交易紀錄');
        setIsExporting(false);
        return;
      }

      const years = new Set<string>();
      const months = new Set<string>();
      transactions.forEach(t => {
        const d = new Date(t.date);
        years.add(format(d, 'yyyy'));
        months.add(format(d, 'MM'));
      });

      const wb = XLSX.utils.book_new();
      const headers = ['日期', '類型', '金額', '幣別', '基準金額(TWD)', '分類', '支付方式', '備註'];

      const addSheet = (sheetData: Transaction[], sheetName: string) => {
        const ws = XLSX.utils.aoa_to_sheet([
          headers,
          ...sheetData.map(d => [
            format(new Date(d.date), 'yyyy-MM-dd'),
            d.type === 'expense' ? '支出' : d.type === 'income' ? '收入' : '轉帳',
            d.amount,
            d.currency,
            d.baseAmount,
            catMap.get(d.categoryId) || d.categoryId,
            pmMap.get(d.paymentMethodId) || d.paymentMethodId,
            d.notes || ''
          ])
        ]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      if (years.size > 1) {
        Array.from(years).sort().forEach(year => {
          const yearData = transactions.filter(t => format(new Date(t.date), 'yyyy') === year);
          addSheet(yearData, `${year}年`);
        });
      } else if (months.size > 1) {
        Array.from(months).sort().forEach(month => {
          const monthData = transactions.filter(t => format(new Date(t.date), 'MM') === month);
          const monthNum = parseInt(month, 10);
          addSheet(monthData, `${monthNum}月`);
        });
      } else {
        if (months.size === 1) {
          const monthNum = parseInt(Array.from(months)[0], 10);
          addSheet(transactions, `${monthNum}月`);
        } else {
          addSheet(transactions, `匯出資料`);
        }
      }

      const exportName = `fintrack_export_${startDate ? startDate.replace(/-/g, '') : 'all'}_${endDate ? endDate.replace(/-/g, '') : 'all'}.xlsx`;
      XLSX.writeFile(wb, exportName);

    } catch (e) {
      console.error(e);
      alert('匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">資料管理</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 space-y-4">

        <div className="flex flex-col gap-4">
          <div>
            <div className="font-medium">匯出資料 (Excel)</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">將您的交易紀錄下載為 Excel 檔案。可選擇特定日期範圍，系統將自動分頁。</div>
          </div>
          
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800/50 dark:bg-zinc-800/20">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0 w-12 text-right">開始：</span>
                <DatePicker value={startDate} onChange={setStartDate} type="date" className="flex-1" />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0 w-12 text-right">結束：</span>
                <DatePicker value={endDate} onChange={setEndDate} type="date" className="flex-1" />
              </div>
            </div>
            
            <div className="flex justify-end pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {isExporting ? '匯出中...' : '匯出'}
              </button>
            </div>
          </div>
        </div>

        {/* 暫時隱藏匯入功能
        <div className="border-t border-zinc-200 dark:border-zinc-800 my-4"></div>

        <div className="flex items-center justify-between opacity-50 cursor-not-allowed" title="未來更新中提供">
          <div>
            <div className="font-medium">匯入資料 (Excel/CSV)</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">從檔案匯入交易紀錄。</div>
          </div>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium dark:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            匯入
          </button>
        </div>
        */}

      </div>
    </div>
  );
}
