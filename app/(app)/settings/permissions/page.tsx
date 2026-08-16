'use client';

import { useState, useEffect } from 'react';
import { Camera, Bell, Image as ImageIcon, Calendar, AlertCircle, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { HiddenLink as Link } from '@/components/ui/HiddenLink';
import { auth } from '@/lib/firebase';
import { getUserSettings, setUserSettings } from '@/lib/db';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/PageHeader';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'loading';

export default function PermissionsPage() {
  const [cameraState, setCameraState] = useState<PermissionState>('loading');
  const [notificationState, setNotificationState] = useState<PermissionState>('loading');
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState<boolean>(false);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      if (user) {
        try {
          const settings = await getUserSettings(user.uid);
          if (settings && settings.calendarSyncEnabled) {
            setCalendarSyncEnabled(true);
          }
        } catch (error) {
          console.error('Error fetching user settings:', error);
        } finally {
          setCalendarLoading(false);
        }
      }
    };
    fetchSettings();
  }, [user]);

  useEffect(() => {
    // Check Camera Permission
    const checkCameraPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraState(result.state);
          
          result.onchange = () => {
            setCameraState(result.state);
          };
        } else {
          setCameraState('unsupported');
        }
      } catch (error) {
        console.warn('Camera permission query not supported:', error);
        setCameraState('unsupported');
      }
    };

    // Check Notification Permission
    const checkNotificationPermission = () => {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          setNotificationState('granted');
        } else if (Notification.permission === 'denied') {
          setNotificationState('denied');
        } else {
          setNotificationState('prompt');
        }
      } else {
        setNotificationState('unsupported');
      }
    };

    checkCameraPermission();
    checkNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationState('granted');
    } else if (permission === 'denied') {
      setNotificationState('denied');
    }
  };

  const handleToggleCalendarSync = async () => {
    if (!user) return;
    
    setCalendarLoading(true);
    try {
      if (calendarSyncEnabled) {
        await setUserSettings(user.uid, { calendarSyncEnabled: false });
        setCalendarSyncEnabled(false);
      } else {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
        provider.setCustomParameters({ prompt: 'consent' });
        
        await signInWithPopup(auth, provider);
        await setUserSettings(user.uid, { calendarSyncEnabled: true });
        setCalendarSyncEnabled(true);
      }
    } catch (error: any) {
      console.error('Error linking calendar:', error);
      alert('授權失敗，請稍後再試！');
    } finally {
      setCalendarLoading(false);
    }
  };

  const getStatusBadge = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            已授權
          </span>
        );
      case 'denied':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full dark:bg-red-500/10 dark:text-red-400">
            <AlertCircle className="h-3 w-3" />
            已拒絕
          </span>
        );
      case 'prompt':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full dark:bg-amber-500/10 dark:text-amber-400">
            <HelpCircle className="h-3 w-3" />
            尚未詢問
          </span>
        );
      case 'unsupported':
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-1 rounded-full dark:bg-zinc-800 dark:text-zinc-400">
            未支援
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <PageHeader title="權限管理" backHref="/settings" />
      <header className="hidden md:block">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/settings" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            設定
          </Link>
          <ChevronRight className="h-4 w-4 text-zinc-400" />
          <h1 className="text-xl font-bold tracking-tight">權限管理</h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          管理應用程式要求的手機與裝置權限。
        </p>
      </header>

      <section>
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-800">
            
            {/* 相機權限 */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <Camera className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">相機</div>
                      {getStatusBadge(cameraState)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      用於掃描實體發票或 QR Code。
                    </div>
                  </div>
                </div>
                {cameraState !== 'loading' && (
                  <button 
                    onClick={() => {
                      if (cameraState === 'granted' || cameraState === 'denied') {
                        alert('網頁無法直接更改權限狀態。請前往您的瀏覽器設定或手機系統設定中，手動開啟或關閉相機權限。');
                      } else if (cameraState === 'prompt') {
                        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                          stream.getTracks().forEach(track => track.stop());
                        }).catch(() => {});
                      }
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 transition-colors"
                  >
                    管理
                  </button>
                )}
              </div>
            </div>

            {/* 通知權限 */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">系統推播通知</div>
                      {getStatusBadge(notificationState)}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      允許裝置接收來自應用程式的提醒。若要設定接收哪些通知，請前往 <Link href="/settings/notifications" className="text-blue-600 dark:text-blue-400 hover:underline">通知與提醒管理</Link>。
                    </div>
                  </div>
                </div>
                {notificationState !== 'loading' && (
                  <button 
                    onClick={() => {
                      if (notificationState === 'prompt') {
                        requestNotificationPermission();
                      } else {
                        alert('網頁無法直接更改權限狀態。請前往您的瀏覽器設定或手機系統設定中，手動開啟或關閉通知權限。');
                      }
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 transition-colors"
                  >
                    {notificationState === 'prompt' ? '開啟授權' : '管理'}
                  </button>
                )}
              </div>
            </div>

            {/* 照片與相簿權限 */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <ImageIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">相片圖庫</div>
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-1 rounded-full dark:bg-zinc-700 dark:text-zinc-400">
                        由系統控管
                      </span>
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      用於上傳發票圖片。當您上傳圖片時，系統會自動詢問您的同意，網頁無法主動偵測。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Google 日曆同步 */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <Calendar className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">Google 日曆存取</div>
                      {!calendarLoading && calendarSyncEnabled ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          已連結
                        </span>
                      ) : !calendarLoading ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-1 rounded-full dark:bg-zinc-700 dark:text-zinc-400">
                          尚未連結
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      授權將應用程式的提醒事項同步至您的 Google 日曆。
                    </div>
                  </div>
                </div>
                {!calendarLoading && (
                  <button 
                    onClick={handleToggleCalendarSync}
                    disabled={calendarLoading}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
                  >
                    {calendarSyncEnabled ? '取消連結' : '連結帳號'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
