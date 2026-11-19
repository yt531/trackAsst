'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { readNotifyDebug, showLocalNotification, type NotifyDebug } from '@/lib/local-notify';
import { registerPushDevice, type PushRegisterResult } from '@/lib/push';

const PUSH_STATUS_TEXT: Record<PushRegisterResult | 'checking' | 'error', string> = {
  checking: '檢查中...',
  ok: '已登記（這台裝置可接收背景推播）',
  denied: '尚未允許通知權限',
  unsupported: '此瀏覽器不支援背景推播',
  'no-service-worker': '尚未註冊 Service Worker（開發環境或剛載入，請重新整理）',
  'no-vapid-key': '缺少 VAPID 金鑰設定',
  error: '登記失敗（請看主控台）',
};

export function NotificationSettings() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  const [debug, setDebug] = useState<NotifyDebug>({});
  const [swStatus, setSwStatus] = useState('檢查中...');
  const [pushStatus, setPushStatus] = useState<PushRegisterResult | 'checking' | 'error'>('checking');
  const [pushError, setPushError] = useState('');

  // 已允許通知時，確認這台裝置有登記推播 token（可重複執行）
  useEffect(() => {
    if (!user) return;
    registerPushDevice(user.uid).then(result => {
      setPushStatus(result);
      setPushError('');
    }).catch(err => {
      console.error('Failed to register push device', err);
      setPushStatus('error');
      // 手機沒有主控台可看，直接把實際錯誤顯示在診斷區
      setPushError(`${err?.code ?? err?.name ?? 'Error'}: ${String(err?.message ?? err).slice(0, 300)}`);
    });
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    setDebug(readNotifyDebug());
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        setSwStatus(reg ? `${reg.scope}（${reg.active ? '運作中' : '尚未啟用'}）` : '未註冊');
      });
    } else {
      setSwStatus('瀏覽器不支援');
    }
  }, []);

  const sendTest = async () => {
    await showLocalNotification('輕鬆記', '這是一則測試通知', { link: '/notifications', tag: 'test-notification' });
    setDebug(readNotifyDebug());
  };

  const requestPermission = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const p = await Notification.requestPermission();
      setPermission(p);

      if (p === 'granted') {
        const result = await registerPushDevice(user.uid);
        setPushStatus(result);
        alert(
          result === 'ok'
            ? '通知已啟用！這台裝置會收到管理員通知與公告的推播（App 關閉也會收到）。'
            : `通知權限已允許，但背景推播尚未啟用：${PUSH_STATUS_TEXT[result]}。App 開啟時仍會顯示通知。`
        );
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      alert('無法啟用通知，請檢查瀏覽器設定。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">通知與提醒</h2>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${permission === 'granted' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:text-zinc-400 dark:bg-zinc-800'}`}>
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">推播通知 (Web Push)</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {permission === 'granted' ? '已開啟通知' : permission === 'denied' ? '您已封鎖通知' : '開啟通知以接收新通知提醒'}
              </div>
            </div>
          </div>
          <div>
            {permission !== 'granted' && permission !== 'denied' && (
              <button
                onClick={requestPermission}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '設定中...' : '啟用通知'}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          若您使用 iOS 裝置，請先將此網頁「加入主畫面」後才能啟用通知功能。
        </p>

        {/* 診斷：協助確認這台裝置為什麼沒有彈出系統通知 */}
        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">通知診斷</span>
            <button
              onClick={sendTest}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
            >
              傳送測試通知
            </button>
          </div>
          <div>瀏覽器權限：{permission}</div>
          <div className="break-all">Service Worker：{swStatus}</div>
          <div>背景推播裝置：{PUSH_STATUS_TEXT[pushStatus]}</div>
          {pushError && <div className="break-all text-rose-500">錯誤內容：{pushError}</div>}
          <div>
            最近偵測到新通知：
            {debug.event
              ? `${new Date(debug.event.at).toLocaleString()}，當時頁面${debug.event.visibility === 'visible' ? '在前景（不彈出）' : '在背景'}，共 ${debug.event.count} 則`
              : '尚無紀錄'}
          </div>
          <div className="break-all">
            最近嘗試顯示系統通知：
            {debug.shown
              ? `${new Date(debug.shown.at).toLocaleString()}，${debug.shown.ok ? '成功' : '失敗'}（${debug.shown.via}）${debug.shown.error ? ` ${debug.shown.error}` : ''}`
              : '尚無紀錄'}
          </div>
        </div>
      </div>
    </div>
  );
}
