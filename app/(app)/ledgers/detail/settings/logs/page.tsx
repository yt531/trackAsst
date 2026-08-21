'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLedger } from '@/components/LedgerProvider';
import { useRouter } from 'next/navigation';
import { getLedgerMembers, updateLedger } from '@/lib/ledger';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { ActivityFeedItem, LedgerMember } from '@/types';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Trash2, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { activeLedgerId, activeLedger } = useLedger();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Record<string, LedgerMember>>({});
  const [logs, setLogs] = useState<ActivityFeedItem[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      if (!activeLedgerId || !user) return;
      setLoading(true);
      
      const ledgerMembers = await getLedgerMembers(activeLedgerId);
      const currentUserMember = ledgerMembers.find(m => m.userId === user.uid);
      
      if (currentUserMember?.role !== 'admin') {
        alert('無權限存取此頁面');
        router.push(`/ledgers/detail/settings?id=${activeLedgerId}`);
        return;
      }
      setIsAdmin(true);

      const membersMap = ledgerMembers.reduce((acc, m) => {
        acc[m.userId] = m;
        return acc;
      }, {} as Record<string, LedgerMember>);
      setMembers(membersMap);
      
      await loadLogsForMonth(currentMonth);
    };

    checkAuthAndLoad();
  }, [activeLedgerId, user, currentMonth, router]);

  const loadLogsForMonth = async (date: Date) => {
    if (!activeLedgerId) return;
    setLoading(true);
    try {
      const start = startOfMonth(date).getTime();
      const end = endOfMonth(date).getTime();

      const q = query(
        collection(db, 'ledgers', activeLedgerId, 'activityFeed'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end),
        orderBy('timestamp', 'desc')
      );
      
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityFeedItem)));
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActorName = (actorId: string) => {
    if (actorId === user?.uid) return '您';
    const member = members[actorId];
    return member?.nickname || `使用者 ${actorId.slice(0, 4)}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      
      const exportData = logs.map(item => ({
        '日期': format(new Date(item.timestamp), 'yyyy-MM-dd'),
        '時間': format(new Date(item.timestamp), 'HH:mm:ss'),
        '操作人員': getActorName(item.actorId),
        '操作類型': (() => {
          switch (item.type) {
            case 'transaction_created': return '新增交易';
            case 'transaction_updated': return '修改交易';
            case 'transaction_deleted': return '刪除交易';
            case 'member_joined': return '加入帳本';
            case 'member_left': return '退出帳本';
            case 'settlement': return '帳本結算';
            default: return item.type;
          }
        })(),
        '詳細內容': item.type === 'member_joined' 
          ? item.details 
          : item.type === 'transaction_created'
            ? `新增了一筆交易：${item.details}`
            : item.type === 'transaction_updated'
              ? `修改了一筆交易：金額變更為 ${item.details}`
              : item.type === 'transaction_deleted'
                ? `刪除了一筆交易${item.details ? ` (${item.details})` : ''}`
                : item.details
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Logs");
      XLSX.writeFile(wb, `Audit_Logs_${activeLedger?.name || 'Ledger'}_${format(currentMonth, 'yyyyMM')}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearLogs = async () => {
    if (!activeLedgerId) return;
    const confirmClear = window.confirm(`確定要清除前台的動態時報嗎？\n這會將目前顯示的所有動態時報對所有成員隱藏（管理員仍可在此頁面查看歷史紀錄）。`);
    if (!confirmClear) return;

    setIsClearing(true);
    try {
      // Set the global hidden until timestamp to NOW
      await updateLedger(activeLedgerId, {
        feedHiddenUntil: Date.now()
      });
      alert('已成功清除前台的動態時報顯示！');
    } catch (err) {
      console.error('Clear feed failed', err);
      alert('清除失敗');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isAdmin && loading) {
    return <div className="p-8 text-center text-sm text-zinc-500">驗證權限中...</div>;
  }

  return (
    <div className="relative min-h-screen pb-24 bg-zinc-50 dark:bg-zinc-950">
      <PageHeader 
        title="系統日誌 (Audit Logs)" 
        backHref={`/ledgers/detail/settings?id=${activeLedgerId}`} 
      />

      <div className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        {/* Top Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          
          {/* Month Selector */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-lg min-w-[100px] text-center">
              {format(currentMonth, 'yyyy年 MM月')}
            </span>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={format(currentMonth, 'yyyyMM') === format(new Date(), 'yyyyMM')}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting || logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {isExporting ? '匯出中...' : '匯出 Excel'}
            </button>
            <button
              onClick={handleClearLogs}
              disabled={isClearing}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              隱藏所有前台動態
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            此頁面僅供管理員查閱帳本歷史操作紀錄（包含被隱藏的動態）。執行「隱藏所有前台動態」會讓一般成員看不到目前的時報內容，但資料仍會永久保存在此日誌中供查閱與匯出。
          </p>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500">載入日誌中...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              這個月沒有任何操作紀錄。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">時間</th>
                    <th className="px-6 py-3 font-medium">操作人員</th>
                    <th className="px-6 py-3 font-medium w-full">詳細內容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4 text-zinc-500">
                        {format(new Date(log.timestamp), 'MM/dd HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {getActorName(log.actorId)}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300 whitespace-normal min-w-[300px]">
                        {log.type === 'member_joined' 
                          ? log.details 
                          : log.type === 'transaction_created'
                            ? `新增了一筆交易：${log.details}`
                            : log.type === 'transaction_updated'
                              ? `修改了一筆交易：金額變更為 ${log.details}`
                              : log.type === 'transaction_deleted'
                                ? `刪除了一筆交易${log.details ? ` (${log.details})` : ''}`
                                : log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
