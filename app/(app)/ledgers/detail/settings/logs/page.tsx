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
import { ChevronLeft, ChevronRight, Download, Trash2, ShieldAlert, ArrowUpDown } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { activeLedgerId, activeLedger } = useLedger();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Record<string, LedgerMember>>({});
  const [logs, setLogs] = useState<ActivityFeedItem[]>([]);
  
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [exportMonth, setExportMonth] = useState<Date>(new Date());
  const [filterActorId, setFilterActorId] = useState<string>('all');
  const [filterActionType, setFilterActionType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'view' | 'export' | 'hide'>('view');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearDate, setClearDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

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
      
      await loadLogsForMonth(viewMonth);
    };

    checkAuthAndLoad();
  }, [activeLedgerId, user, viewMonth, router]);

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
    if (member?.nickname) return member.nickname;
    if (member?.role === 'admin') return '管理員';
    return `使用者 ${actorId.slice(0, 4)}`;
  };

  const getActionTypeName = (type: string) => {
    switch (type) {
      case 'transaction_created': return '新增交易';
      case 'transaction_updated': return '修改交易';
      case 'transaction_deleted': return '刪除交易';
      case 'member_joined': return '加入帳本';
      case 'member_left': return '退出帳本';
      case 'settlement': return '帳本結算';
      default: return type;
    }
  };

  const handleExport = async () => {
    if (!activeLedgerId) return;
    setIsExporting(true);
    try {
      const start = startOfMonth(exportMonth).getTime();
      const end = endOfMonth(exportMonth).getTime();

      const q = query(
        collection(db, 'ledgers', activeLedgerId, 'activityFeed'),
        where('timestamp', '>=', start),
        where('timestamp', '<=', end),
        orderBy('timestamp', 'desc')
      );
      
      const snap = await getDocs(q);
      const exportLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityFeedItem));

      if (exportLogs.length === 0) {
        alert('此月份無任何紀錄可匯出');
        return;
      }

      const XLSX = await import('xlsx');
      
      const exportData = exportLogs.map(item => ({
        '日期': format(new Date(item.timestamp), 'yyyy-MM-dd'),
        '時間': format(new Date(item.timestamp), 'HH:mm:ss'),
        '操作人員': getActorName(item.actorId),
        '操作類型': getActionTypeName(item.type),
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
      XLSX.writeFile(wb, `Audit_Logs_${activeLedger?.name || 'Ledger'}_${format(exportMonth, 'yyyyMM')}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearLogs = async () => {
    if (!activeLedgerId || !clearDate) return;
    
    const selectedDate = new Date(clearDate);
    selectedDate.setHours(23, 59, 59, 999);
    const hiddenUntil = selectedDate.getTime();

    const confirmClear = window.confirm(`確定要隱藏 ${clearDate} (含) 以前的前台動態時報嗎？\n管理員仍可在此頁面查看歷史紀錄。`);
    if (!confirmClear) return;

    setIsClearing(true);
    try {
      await updateLedger(activeLedgerId, {
        feedHiddenUntil: hiddenUntil
      });
      alert(`已成功隱藏 ${clearDate} 以前的前台動態時報顯示！`);
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
        {/* Tabs Navigation */}
        <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'view' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            檢視日誌
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'export' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            }`}
          >
            匯出日誌
          </button>
          <button
            onClick={() => setActiveTab('hide')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'hide' ? 'bg-white dark:bg-zinc-700 shadow-sm text-red-600 dark:text-red-400' : 'text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400'
            }`}
          >
            隱藏動態
          </button>
        </div>

        {/* Tab Content: View Logs */}
        {activeTab === 'view' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">選擇檢視月份</span>
              <input
                type="month"
                value={format(viewMonth, 'yyyy-MM')}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setViewMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }
                }}
                max={format(new Date(), 'yyyy-MM')}
                className="w-full sm:w-auto px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-medium bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filters */}
            {!loading && logs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <SearchableSelect
                  value={filterActorId}
                  onChange={setFilterActorId}
                  options={[
                    { value: 'all', label: '所有操作人員' },
                    ...Array.from(new Set(logs.map(l => l.actorId))).map(actorId => ({
                      value: actorId,
                      label: getActorName(actorId)
                    }))
                  ]}
                  placeholder="篩選操作人員..."
                  searchPlaceholder="搜尋名稱..."
                />

                <SearchableSelect
                  value={filterActionType}
                  onChange={setFilterActionType}
                  options={[
                    { value: 'all', label: '所有操作類型' },
                    ...Array.from(new Set(logs.map(l => l.type))).map(type => ({
                      value: type,
                      label: getActionTypeName(type)
                    }))
                  ]}
                  placeholder="篩選操作類型..."
                  searchPlaceholder="搜尋類型..."
                />
              </div>
            )}

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
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors group" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                      <div className="flex items-center gap-1">
                        日期
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                      </div>
                    </th>
                    <th className="px-6 py-3 font-medium cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors group" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                      <div className="flex items-center gap-1">
                        時間
                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                      </div>
                    </th>
                    <th className="px-6 py-3 font-medium">操作人員</th>
                    <th className="px-6 py-3 font-medium">操作類型</th>
                    <th className="px-6 py-3 font-medium w-full">詳細內容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {[...logs]
                    .filter(log => (filterActorId === 'all' || log.actorId === filterActorId) && (filterActionType === 'all' || log.type === filterActionType))
                    .sort((a, b) => sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)
                    .map(log => (
                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-6 py-4 text-zinc-500">
                        {format(new Date(log.timestamp), 'yyyy-MM-dd')}
                      </td>
                      <td className="px-6 py-4 text-zinc-500">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {getActorName(log.actorId)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {getActionTypeName(log.type)}
                        </span>
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
    )}

    {/* Tab Content: Export Logs */}
        {activeTab === 'export' && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto space-y-6 mt-8">
            <div className="text-center">
              <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 mb-2">匯出日誌</h3>
              <p className="text-sm text-zinc-500">選擇想匯出的月份，將下載 Excel 檔案</p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-left">選擇匯出月份</label>
              <input
                type="month"
                value={format(exportMonth, 'yyyy-MM')}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setExportMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }
                }}
                max={format(new Date(), 'yyyy-MM')}
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base font-medium bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Download className="w-5 h-5" />
              {isExporting ? '匯出中...' : '下載 Excel'}
            </button>
          </div>
        )}

        {/* Tab Content: Hide Feed */}
        {activeTab === 'hide' && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 max-w-md mx-auto space-y-6 mt-8">
            <div className="text-center">
              <h3 className="font-semibold text-lg text-red-600 dark:text-red-400 mb-2">隱藏動態</h3>
              <p className="text-sm text-zinc-500">選擇特定日期，隱藏前台動態時報</p>
            </div>

            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                執行後會讓一般成員看不到該日期（含）以前的時報內容，但資料仍會永久保存在此系統日誌中供查閱。
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">選擇截止日期</label>
                <input
                  type="date"
                  value={clearDate}
                  onChange={(e) => setClearDate(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 font-medium outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              
              <button
                onClick={handleClearLogs}
                disabled={isClearing || !clearDate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
                執行隱藏
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
