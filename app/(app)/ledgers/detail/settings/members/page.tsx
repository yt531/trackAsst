'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, MoreVertical, Trash2, ShieldAlert } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getLedgerMembers, updateLedgerMember, removeLedgerMember } from '@/lib/ledger';
import { LedgerMember, LedgerRole } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

export default function MembersListPage() {
  const { activeLedger, activeLedgerId } = useLedger();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!activeLedgerId) return;
    setLoading(true);
    const m = await getLedgerMembers(activeLedgerId);
    setMembers(m);
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, [activeLedgerId]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdownId && !(e.target as Element).closest('.member-dropdown-container')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  const currentUserMember = members.find(m => m.userId === user?.uid);
  const isAdmin = currentUserMember?.role === 'admin';
  const adminCount = members.filter(m => m.role === 'admin').length;

  const getRoleLabel = (role: LedgerRole) => {
    switch(role) {
      case 'admin': return '管理員';
      case 'editor': return '編輯者';
      case 'viewer': return '檢視者';
      default: return '一般成員';
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: LedgerRole) => {
    if (!activeLedgerId || !isAdmin) return;
    setOpenDropdownId(null);
    
    // Prevent demoting the last admin
    if (newRole !== 'admin') {
      const targetMember = members.find(m => m.userId === targetUserId);
      if (targetMember?.role === 'admin' && adminCount <= 1) {
        alert('無法修改權限：帳本必須至少保留一位管理員。');
        return;
      }
    }

    try {
      await updateLedgerMember(activeLedgerId, targetUserId, { role: newRole });
      await loadMembers();
    } catch (e) {
      console.error(e);
      alert('更新權限失敗');
    }
  };

  const handleDeleteMember = async (targetUserId: string) => {
    if (!activeLedgerId || !isAdmin) return;
    setOpenDropdownId(null);

    if (targetUserId === user?.uid) {
      alert('您不能在此刪除自己，請使用「退出帳本」功能。');
      return;
    }

    const targetMember = members.find(m => m.userId === targetUserId);
    if (targetMember?.role === 'admin' && adminCount <= 1) {
      alert('無法刪除：帳本必須至少保留一位管理員。');
      return;
    }

    if (!confirm('確定要移除此成員嗎？')) return;

    try {
      await removeLedgerMember(activeLedgerId, targetUserId);
      await loadMembers();
    } catch (e) {
      console.error(e);
      alert('移除成員失敗');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="成員列表" backHref={`/ledgers/detail/settings?id=${activeLedgerId}`} />
      
      <header className="hidden md:flex items-center gap-4">
        <button onClick={() => router.push(`/ledgers/detail/settings?id=${activeLedgerId}`)} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">成員列表</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {activeLedger?.name} 的所有成員
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('view')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'view' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' 
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          檢視成員
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'edit' 
                ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400' 
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            編輯權限
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-visible divide-y divide-zinc-200 dark:divide-zinc-700">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">載入中...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">無成員資訊</div>
        ) : (
          members.map((member) => {
            const isMe = member.userId === user?.uid;
            const displayName = member.nickname || (isMe ? (user?.displayName || '未設定') : '未設定');
            const initial = displayName.charAt(0).toUpperCase();
            const isDropdownOpen = openDropdownId === member.userId;

            return (
              <div key={member.id} className="flex items-center justify-between p-4 relative member-dropdown-container">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold">
                    {initial}
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {displayName}
                      {isMe && <span className="text-xs font-normal text-zinc-400">(您)</span>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      加入時間: {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    member.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      : member.role === 'editor'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}>
                    {getRoleLabel(member.role)}
                  </span>

                  {activeTab === 'edit' && isAdmin && (
                    <div className="relative">
                      <button 
                        onClick={() => setOpenDropdownId(isDropdownOpen ? null : member.userId)}
                        className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1.5 z-10">
                          <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 border-b border-zinc-100 dark:border-zinc-700/50 mb-1">修改權限</div>
                          
                          <button
                            onClick={() => handleUpdateRole(member.userId, 'admin')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-between"
                          >
                            管理員
                            {member.role === 'admin' && <span className="text-blue-600">✓</span>}
                          </button>
                          <button
                            onClick={() => handleUpdateRole(member.userId, 'editor')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-between"
                          >
                            編輯者
                            {member.role === 'editor' && <span className="text-blue-600">✓</span>}
                          </button>
                          <button
                            onClick={() => handleUpdateRole(member.userId, 'viewer')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-between"
                          >
                            檢視者
                            {member.role === 'viewer' && <span className="text-blue-600">✓</span>}
                          </button>

                          {!isMe && (
                            <>
                              <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1.5" />
                              <button
                                onClick={() => handleDeleteMember(member.userId)}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                移除成員
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
