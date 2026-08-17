'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, Plus, Users, Key, Settings as SettingsIcon, QrCode, Copy, CheckCircle2 } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { useState, useEffect } from 'react';
import { getLedgerMembers, createLedgerInvitation } from '@/lib/ledger';
import { generateShortCode } from '@/lib/invitation';
import { LedgerMember, LedgerRole, LedgerInvitation } from '@/types';
import { QRCodeSVG } from 'qrcode.react';

export default function LedgersSettingsPage() {
  const { activeLedger, activeLedgerId } = useLedger();
  const { user } = useAuth();
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Invitation Form State
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<LedgerRole>('editor');
  const [inviteExpiry, setInviteExpiry] = useState<number>(24 * 60 * 60 * 1000); // Default 1 day
  const [inviteMode, setInviteMode] = useState<'single' | 'multi'>('single');
  const [maxUsage, setMaxUsage] = useState<number>(5);
  const [generatedInvite, setGeneratedInvite] = useState<LedgerInvitation | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeLedgerId) {
      setLoading(true);
      getLedgerMembers(activeLedgerId).then(m => {
        setMembers(m);
        setLoading(false);
      });
    }
  }, [activeLedgerId]);

  const handleGenerateInvite = async () => {
    if (!activeLedgerId || !user) return;
    if (inviteMode === 'single' && !inviteEmail) {
      alert('請輸入受邀者 Email');
      return;
    }
    
    setInviteLoading(true);
    try {
      const code = generateShortCode();
      const expiresAt = Date.now() + inviteExpiry;
      
      const newInvitation: LedgerInvitation = {
        id: code,
        ledgerId: activeLedgerId,
        createdBy: user.uid,
        maxUsage: inviteMode === 'multi' ? maxUsage : 1,
        defaultRole: inviteRole,
        expiresAt,
        status: 'active',
        usageCount: 0,
        createdAt: Date.now(),
        ...(inviteMode === 'single' ? { targetEmailOrId: inviteEmail } : {})
      };
      
      await createLedgerInvitation(newInvitation);
      setGeneratedInvite(newInvitation);
    } catch (error) {
      console.error('Failed to generate invite:', error);
      alert('產生邀請碼失敗，請稍後再試。');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleLabel = (role: LedgerRole) => {
    switch(role) {
      case 'admin': return '管理員';
      case 'editor': return '編輯者';
      case 'viewer': return '檢視者';
      default: return '一般成員';
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                成員列表
              </h2>
              {/* Only admin can invite */}
              <button 
                onClick={() => {
                  setShowInviteForm(!showInviteForm);
                  setGeneratedInvite(null);
                }}
                className={`flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  showInviteForm 
                    ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Key className="h-4 w-4" />
                {showInviteForm ? '取消邀請' : '邀請成員'}
              </button>
            </div>

            {/* Invitation Form Area */}
            {showInviteForm && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
                <h3 className="mb-4 text-sm font-bold text-blue-900 dark:text-blue-200">建立邀請碼</h3>
                
                {!generatedInvite ? (
                  <div className="space-y-4">
                    {/* Invitation Mode Selection */}
                    <div className="flex gap-2 p-1 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg">
                      <button
                        onClick={() => setInviteMode('single')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          inviteMode === 'single' 
                            ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        指定對象 (高安全性)
                      </button>
                      <button
                        onClick={() => setInviteMode('multi')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          inviteMode === 'multi' 
                            ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-300 shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        共用連結 (多人加入)
                      </button>
                    </div>

                    {inviteMode === 'single' ? (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">受邀者 Email</label>
                        <input 
                          type="email" 
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="輸入對方的電子信箱" 
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <p className="mt-1 text-xs text-zinc-500">為了安全起見，只有該 Email 登入的使用者才能使用此邀請碼加入。此邀請碼限用 1 次。</p>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">可加入人數上限 (最多 10 人)</label>
                        <input 
                          type="number" 
                          min={1}
                          max={10}
                          value={maxUsage}
                          onChange={(e) => setMaxUsage(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <p className="mt-1 text-xs text-zinc-500">任何人只要取得此邀請碼即可加入，直到人數達到上限為止。</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">角色權限</label>
                        <select 
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as LedgerRole)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                        >
                          <option value="admin">管理員</option>
                          <option value="editor">編輯者</option>
                          <option value="viewer">檢視者</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">到期時間</label>
                        <select 
                          value={inviteExpiry}
                          onChange={(e) => setInviteExpiry(Number(e.target.value))}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                        >
                          <option value={24 * 60 * 60 * 1000}>24 小時</option>
                          <option value={3 * 24 * 60 * 60 * 1000}>3 天</option>
                          <option value={7 * 24 * 60 * 60 * 1000}>7 天</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerateInvite}
                      disabled={inviteLoading}
                      className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {inviteLoading ? '產生中...' : '產生邀請碼與 QR Code'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-5 rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-800">
                    <div className="text-center">
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                        {generatedInvite.targetEmailOrId 
                          ? `專屬邀請碼 (指定給: ${generatedInvite.targetEmailOrId})` 
                          : `共用邀請碼 (人數上限: ${generatedInvite.maxUsage} 人)`}
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-black tracking-widest text-blue-600 dark:text-blue-400">
                          {generatedInvite.id}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(generatedInvite.id)}
                          className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        >
                          {copied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        權限：{getRoleLabel(generatedInvite.defaultRole)} • 到期日：{new Date(generatedInvite.expiresAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700">
                      <QRCodeSVG 
                        value={`${window.location.origin}/ledgers?invite=${generatedInvite.id}`}
                        size={180}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    
                    <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 max-w-[250px]">
                      對方可使用手機相機掃描上述 QR Code，或在「加入共享帳本」頁面直接輸入邀請碼。
                    </p>

                    <button 
                      onClick={() => {
                        setGeneratedInvite(null);
                        setInviteEmail('');
                      }}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      產生另一個邀請碼
                    </button>
                  </div>
                )}
              </div>
            )}
            
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
                        : member.role === 'editor'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
                    }`}>
                      {getRoleLabel(member.role)}
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
