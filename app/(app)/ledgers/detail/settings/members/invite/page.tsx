'use client';

import { useLedger } from '@/components/LedgerProvider';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, Key, Copy, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getLedgerMembers, createLedgerInvitation } from '@/lib/ledger';
import { generateShortCode } from '@/lib/invitation';
import { LedgerMember, LedgerRole, LedgerInvitation } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

export default function InviteMemberPage() {
  const { activeLedger, activeLedgerId } = useLedger();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ledgerId = searchParams.get('id');

  const [members, setMembers] = useState<LedgerMember[]>([]);
  
  // Invitation Form State
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
      getLedgerMembers(activeLedgerId).then(m => {
        setMembers(m);
      });
    }
  }, [activeLedgerId]);

  const currentUserMember = members.find(m => m.userId === user?.uid);
  const isAdmin = currentUserMember?.role === 'admin';

  // Prevent non-admins from viewing this page
  useEffect(() => {
    if (members.length > 0 && !isAdmin) {
      alert('您沒有權限邀請成員');
      router.push(`/ledgers/detail/settings?id=${activeLedgerId}`);
    }
  }, [members, isAdmin, router, activeLedgerId]);

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

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="邀請成員" backHref={`/ledgers/detail/settings?id=${activeLedgerId}`} />
      
      <header className="hidden md:flex items-center gap-4">
        <button onClick={() => router.push(`/ledgers/detail/settings?id=${activeLedgerId}`)} className="p-2 hover:bg-zinc-100 rounded-full dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">邀請成員</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            為「{activeLedger?.name}」產生專屬或共用邀請碼
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-blue-200 bg-white p-5 dark:border-blue-900/30 dark:bg-zinc-800 shadow-sm">
        {!generatedInvite ? (
          <div className="space-y-6">
            {/* Invitation Mode Selection */}
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900/50 rounded-lg">
              <button
                onClick={() => setInviteMode('single')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  inviteMode === 'single' 
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                指定對象 (高安全性)
              </button>
              <button
                onClick={() => setInviteMode('multi')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  inviteMode === 'multi' 
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                共用連結 (多人加入)
              </button>
            </div>

            {inviteMode === 'single' ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">受邀者 Email</label>
                <input 
                  type="email" 
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="輸入對方的電子信箱" 
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900"
                />
                <p className="mt-1.5 text-xs text-zinc-500">為了安全起見，只有該 Email 登入的使用者才能使用此邀請碼加入。此邀請碼限用 1 次。</p>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">可加入人數上限 (最多 10 人)</label>
                <input 
                  type="number" 
                  min={1}
                  max={10}
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900"
                />
                <p className="mt-1.5 text-xs text-zinc-500">任何人只要取得此邀請碼即可加入，直到人數達到上限為止。</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">角色權限</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as LedgerRole)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="admin">管理員</option>
                  <option value="editor">編輯者</option>
                  <option value="viewer">檢視者</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">到期時間</label>
                <select 
                  value={inviteExpiry}
                  onChange={(e) => setInviteExpiry(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900"
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
              className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteLoading ? '產生中...' : '產生邀請碼與 QR Code'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6 p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2">
                {generatedInvite.targetEmailOrId 
                  ? `專屬邀請碼 (指定給: ${generatedInvite.targetEmailOrId})` 
                  : `共用邀請碼 (人數上限: ${generatedInvite.maxUsage} 人)`}
              </p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl font-black tracking-widest text-blue-600 dark:text-blue-400">
                  {generatedInvite.id}
                </span>
                <button 
                  onClick={() => copyToClipboard(generatedInvite.id)}
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  title="複製邀請碼"
                >
                  {copied ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Copy className="h-6 w-6" />}
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                權限：{getRoleLabel(generatedInvite.defaultRole)} • 到期日：{new Date(generatedInvite.expiresAt).toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700">
              <QRCodeSVG 
                value={`${window.location.origin}/ledgers?invite=${generatedInvite.id}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <p className="text-sm text-center text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
              對方可使用手機相機掃描上述 QR Code，或在「加入共享帳本」頁面直接輸入邀請碼。
            </p>

            <button 
              onClick={() => {
                setGeneratedInvite(null);
                setInviteEmail('');
              }}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              產生另一個邀請碼
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
