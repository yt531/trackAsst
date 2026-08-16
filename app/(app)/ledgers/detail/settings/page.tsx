'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, Plus, Users, Key, Settings as SettingsIcon } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useState, useEffect } from 'react';
import { getLedgerMembers } from '@/lib/ledger';
import { LedgerMember } from '@/types';

export default function LedgersSettingsPage() {
  const { activeLedger, activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeLedgerId) {
      setLoading(true);
      getLedgerMembers(activeLedgerId).then(m => {
        setMembers(m);
        setLoading(false);
      });
    }
  }, [activeLedgerId]);

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
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              帳本資訊
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
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
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                成員列表
              </h2>
              {/* Only admin can invite - simplified check for now */}
              <button className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                <Key className="h-4 w-4" />
                邀請成員
              </button>
            </div>
            
            <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
              {loading ? (
                <div className="p-4 text-center text-sm text-zinc-500">載入中...</div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">無成員資訊</div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {member.userId === user?.uid ? '我' : '友'}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {member.userId === user?.uid ? '您 (You)' : `使用者 ID: ${member.userId.slice(0, 6)}...`}
                        </div>
                        <div className="text-xs text-zinc-500">
                          加入時間: {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
                    }`}>
                      {member.role === 'admin' ? '管理員' : '一般成員'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
