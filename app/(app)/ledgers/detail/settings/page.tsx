'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { Settings as SettingsIcon, Users, Key, User as UserIcon, Bell } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLedgerMembers, updateLedger, checkNicknameExists, updateLedgerMember, leaveLedger } from '@/lib/ledger';
import { LedgerMember, LedgerRole, LedgerMode } from '@/types';

export default function LedgersSettingsPage() {
  const { activeLedger, activeLedgerId, refreshLedgers } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [leaving, setLeaving] = useState(false);
  
  // Edit Info State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMode, setEditMode] = useState<LedgerMode>('split');
  const [editCurrency, setEditCurrency] = useState('TWD');

  // My Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (activeLedgerId) {
      setLoading(true);
      getLedgerMembers(activeLedgerId).then(m => {
        setMembers(m);
        setLoading(false);
      });
    }
  }, [activeLedgerId]);

  const handleToggleSetting = async (key: 'allowMembersToCreateCategories' | 'allowMembersToCreateTags', value: boolean) => {
    if (!activeLedgerId || !activeLedger) return;
    try {
      await updateLedger(activeLedgerId, {
        settings: {
          ...activeLedger.settings,
          [key]: value
        }
      });
      await refreshLedgers();
    } catch (e) {
      console.error(e);
      alert('設定更新失敗');
    }
  };

  const currentUserMember = members.find(m => m.userId === user?.uid);
  const isAdmin = currentUserMember?.role === 'admin';

  const handleEditClick = () => {
    if (!activeLedger) return;
    setEditName(activeLedger.name);
    setEditMode(activeLedger.mode || 'split');
    setEditCurrency(activeLedger.currency || 'TWD');
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    if (!activeLedgerId || !activeLedger) return;
    if (!editName.trim()) {
      alert('請輸入帳本名稱');
      return;
    }
    if (!editCurrency.trim()) {
      alert('請輸入主幣別');
      return;
    }
    
    try {
      await updateLedger(activeLedgerId, {
        name: editName.trim(),
        mode: editMode,
        currency: editCurrency.trim().toUpperCase()
      });
      await refreshLedgers();
      setIsEditingInfo(false);
    } catch (e) {
      console.error(e);
      alert('設定更新失敗');
    }
  };

  const handleSaveProfile = async () => {
    if (!activeLedgerId || !user) return;
    if (!editNickname.trim()) {
      alert('請輸入暱稱');
      return;
    }
    
    setProfileLoading(true);
    try {
      const exists = await checkNicknameExists(activeLedgerId, editNickname.trim(), user.uid);
      if (exists) {
        alert('此暱稱已被帳本中其他成員使用，請換一個');
        return;
      }
      await updateLedgerMember(activeLedgerId, user.uid, { nickname: editNickname.trim() });
      const m = await getLedgerMembers(activeLedgerId);
      setMembers(m);
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setProfileLoading(false);
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const otherActiveMembers = activeMembers.filter(m => m.userId !== user?.uid).sort((a, b) => a.joinedAt - b.joinedAt);

  const handleLeaveClick = () => {
    if (!currentUserMember || !user) return;
    
    const adminsCount = activeMembers.filter(m => m.role === 'admin').length;
    const isSoleAdmin = currentUserMember.role === 'admin' && adminsCount === 1;

    if (isSoleAdmin) {
      if (otherActiveMembers.length === 0) {
        alert('您是唯一的活躍成員，無法轉移權限並退出。如果不再使用，請選擇刪除此帳本。');
        return;
      }
      setTransferTargetId(otherActiveMembers[0].userId);
      setShowLeaveDialog(true);
    } else {
      if (confirm('確定要退出此共享帳本嗎？退出後您將無法再查看或新增交易，但您的歷史紀錄仍會被保留。')) {
        executeLeave();
      }
    }
  };

  const executeLeave = async () => {
    if (!activeLedgerId || !user) return;
    setLeaving(true);
    try {
      await leaveLedger(activeLedgerId, user.uid, transferTargetId || undefined);
      
      try {
        const { createActivityFeedItem } = await import('@/lib/transactions');
        await createActivityFeedItem(
          activeLedgerId,
          user.uid,
          'member_left',
          `${currentUserMember?.nickname || '成員'} 退出了帳本`
        );
      } catch (err) {
        console.error('Failed to log activity', err);
      }

      await refreshLedgers();
      router.push('/ledgers');
    } catch (err) {
      console.error(err);
      alert('退出失敗，請稍後再試');
      setLeaving(false);
      setShowLeaveDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {!activeLedgerId ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <Users className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">目前為個人帳本</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            請從側邊欄（或上方選單）切換至欲管理的共享帳本，或點擊上方建立新帳本。
          </p>
        </div>
      ) : activeLedger ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                帳本資訊
              </h2>
              {isAdmin && !isEditingInfo && (
                <button 
                  onClick={handleEditClick}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  編輯
                </button>
              )}
            </div>
            
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              {isEditingInfo ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">帳本名稱</label>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">記帳模式</label>
                      <select 
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value as LedgerMode)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                      >
                        <option value="split">分帳與結算模式</option>
                        <option value="shared_fund">公積金模式</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">主幣別</label>
                      <input 
                        type="text" 
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 uppercase"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50">
                    <button 
                      onClick={() => setIsEditingInfo(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleSaveInfo}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      儲存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-zinc-500">帳本名稱</label>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{activeLedger.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">記帳模式</label>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {activeLedger.mode === 'split' ? '分帳與結算模式' : '公積金模式'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500">主幣別</label>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{activeLedger.currency}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 我的帳本個人檔案 */}
          {currentUserMember && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  我的帳本個人檔案
                </h2>
                {!isEditingProfile && (
                  <button 
                    onClick={() => {
                      setEditNickname(currentUserMember.nickname || user?.displayName || '');
                      setIsEditingProfile(true);
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    編輯
                  </button>
                )}
              </div>
              
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">我在此帳本的名稱</label>
                      <input 
                        type="text" 
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        placeholder="輸入暱稱"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50">
                      <button 
                        onClick={() => setIsEditingProfile(false)}
                        disabled={profileLoading}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleSaveProfile}
                        disabled={profileLoading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {profileLoading ? '儲存中...' : '儲存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-lg font-bold">
                      {(currentUserMember.nickname || user?.displayName || '友').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">我在此帳本的名稱</p>
                      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                        {currentUserMember.nickname || user?.displayName || '未設定'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 通知設定 */}
          {currentUserMember && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知設定
              </h2>
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">有新成員加入時通知我</div>
                    <div className="text-xs text-zinc-500">當其他人加入此共享帳本時，在通知中心提醒我</div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={currentUserMember.notificationPreferences?.memberJoined !== false}
                      onChange={async (e) => {
                        if (!user) return;
                        const checked = e.target.checked;
                        try {
                          await updateLedgerMember(activeLedgerId, user.uid, {
                            notificationPreferences: {
                              ...currentUserMember.notificationPreferences,
                              memberJoined: checked
                            }
                          });
                          setMembers(members.map(m => m.userId === user.uid ? {
                            ...m,
                            notificationPreferences: {
                              ...m.notificationPreferences,
                              memberJoined: checked
                            }
                          } : m));
                        } catch (err) {
                          console.error(err);
                          alert('通知設定更新失敗');
                        }
                      }}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-focus:outline-none dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600 dark:border-gray-600"></div>
                  </label>
                </div>

                {activeLedger.mode === 'split' && (
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">分帳款項提醒</div>
                      <div className="text-xs text-zinc-500">當有人在帳本中將您標記為分攤人時，在通知中心提醒我</div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={currentUserMember.notificationPreferences?.splitAssigned !== false}
                        onChange={async (e) => {
                          if (!user) return;
                          const checked = e.target.checked;
                          try {
                            await updateLedgerMember(activeLedgerId, user.uid, {
                              notificationPreferences: {
                                ...currentUserMember.notificationPreferences,
                                splitAssigned: checked
                              }
                            });
                            setMembers(members.map(m => m.userId === user.uid ? {
                              ...m,
                              notificationPreferences: {
                                ...m.notificationPreferences,
                                splitAssigned: checked
                              }
                            } : m));
                          } catch (err) {
                            console.error(err);
                            alert('通知設定更新失敗');
                          }
                        }}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-focus:outline-none dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600 dark:border-gray-600"></div>
                    </label>
                  </div>
                )}

                {activeLedger.mode === 'shared_fund' && (
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">大額公積金支出提醒</div>
                      <div className="text-xs text-zinc-500">當有人新增大於等於 $1000 的支出時，在通知中心提醒我</div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={currentUserMember.notificationPreferences?.largeExpense !== false}
                        onChange={async (e) => {
                          if (!user) return;
                          const checked = e.target.checked;
                          try {
                            await updateLedgerMember(activeLedgerId, user.uid, {
                              notificationPreferences: {
                                ...currentUserMember.notificationPreferences,
                                largeExpense: checked
                              }
                            });
                            setMembers(members.map(m => m.userId === user.uid ? {
                              ...m,
                              notificationPreferences: {
                                ...m.notificationPreferences,
                                largeExpense: checked
                              }
                            } : m));
                          } catch (err) {
                            console.error(err);
                            alert('通知設定更新失敗');
                          }
                        }}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-focus:outline-none dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600 dark:border-gray-600"></div>
                    </label>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              帳本分類與標籤
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700 overflow-hidden">
              <Link href={`/ledgers/detail/settings/categories?id=${activeLedgerId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">分類管理</div>
                  <div className="text-xs text-zinc-500">管理此帳本專屬的收支分類</div>
                </div>
                <div className="text-zinc-400">&gt;</div>
              </Link>
              <Link href={`/ledgers/detail/settings/tags?id=${activeLedgerId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">標籤管理</div>
                  <div className="text-xs text-zinc-500">管理此帳本專屬的標籤</div>
                </div>
                <div className="text-zinc-400">&gt;</div>
              </Link>
              
              {isAdmin && (
                <div className="p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/30">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">成員權限設定</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">允許成員建立分類</div>
                      <div className="text-xs text-zinc-500">開啟後，編輯者也能新增、修改、刪除分類</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={activeLedger.settings?.allowMembersToCreateCategories || false}
                        onChange={(e) => handleToggleSetting('allowMembersToCreateCategories', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">允許成員建立標籤</div>
                      <div className="text-xs text-zinc-500">開啟後，編輯者也能新增、修改、刪除標籤</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={activeLedger.settings?.allowMembersToCreateTags || false}
                        onChange={(e) => handleToggleSetting('allowMembersToCreateTags', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 帳本成員 */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              帳本成員
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700 overflow-hidden">
              {isAdmin && (
                <Link href={`/ledgers/detail/settings/members/invite?id=${activeLedgerId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      邀請成員
                    </div>
                    <div className="text-xs text-zinc-500">產生專屬或共用邀請碼</div>
                  </div>
                  <div className="text-zinc-400">&gt;</div>
                </Link>
              )}
              <Link href={`/ledgers/detail/settings/members?id=${activeLedgerId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">成員列表</div>
                  <div className="text-xs text-zinc-500">檢視或管理目前帳本內的成員</div>
                </div>
                <div className="text-zinc-400">&gt;</div>
              </Link>
            </div>
          </section>

          {/* 管理員工具 */}
          {isAdmin && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                管理員工具
              </h2>
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
                <Link href={`/ledgers/detail/settings/logs?id=${activeLedgerId}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">查看系統日誌 (Audit Logs)</div>
                    <div className="text-xs text-zinc-500">檢視、匯出帳本內的所有操作紀錄，或清除動態時報</div>
                  </div>
                  <div className="text-zinc-400">&gt;</div>
                </Link>
              </div>
            </section>
          )}

          {/* 退出帳本 */}
          {currentUserMember && (
            <section className="pt-6">
              <button
                onClick={handleLeaveClick}
                disabled={leaving}
                className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              >
                {leaving ? '處理中...' : '退出此共享帳本'}
              </button>
            </section>
          )}

          {/* 轉移權限對話框 */}
          {showLeaveDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">轉移管理員權限並退出</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  您是此帳本的唯一管理員。退出前，您必須先將管理員權限轉移給其他活躍成員。退出後您的歷史紀錄將被保留。
                </p>
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">選擇新管理員</label>
                  <select
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {otherActiveMembers.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.nickname} (加入時間：{new Date(m.joinedAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowLeaveDialog(false)}
                    disabled={leaving}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={executeLeave}
                    disabled={leaving || !transferTargetId}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {leaving ? '處理中...' : '確認轉移並退出'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
