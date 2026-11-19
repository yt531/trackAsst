// 由前景頁面在 App 位於背景時顯示系統通知，不需要伺服器。
// 限制：App 完全關閉（或被手機系統凍結）時收不到，那需要真正的推播（FCM 發送端）。

const DEBUG_KEY = 'notifyDebug';

export interface NotifyDebug {
  // 最近一次偵測到新通知（頁面當下是前景或背景）
  event?: { at: number; visibility: string; count: number };
  // 最近一次嘗試顯示系統通知的結果
  shown?: { at: number; via: 'sw' | 'new' | 'none'; ok: boolean; error?: string };
}

export const readNotifyDebug = (): NotifyDebug => {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_KEY) || '{}');
  } catch {
    return {};
  }
};

// 診斷用：記錄在手機上實際發生了什麼，顯示在「設定 → 通知」
export const recordNotifyDebug = (patch: NotifyDebug) => {
  try {
    localStorage.setItem(DEBUG_KEY, JSON.stringify({ ...readNotifyDebug(), ...patch }));
  } catch {
    // 診斷資訊寫入失敗不影響功能
  }
};

export const showLocalNotification = async (
  title: string,
  body: string,
  options: { link?: string; tag?: string } = {},
) => {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    recordNotifyDebug({ shown: { at: Date.now(), via: 'none', ok: false, error: `permission=${'Notification' in window ? Notification.permission : 'unsupported'}` } });
    return;
  }
  let via: 'sw' | 'new' = 'new';
  try {
    // 優先用 Service Worker 顯示（手機瀏覽器不支援直接 new Notification）
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    // 以 SW scope 當作網站根路徑，GitHub Pages 的子路徑（basePath）才會正確
    const scope = registration?.scope ?? `${location.origin}/`;
    const notificationOptions = {
      body,
      icon: `${scope}icon-192x192.png`,
      tag: options.tag, // 相同 tag 會取代舊的，避免多個分頁重複彈出
      data: { url: new URL((options.link ?? '').replace(/^\//, ''), scope).href },
    };
    if (registration) {
      via = 'sw';
      await registration.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
    recordNotifyDebug({ shown: { at: Date.now(), via, ok: true } });
  } catch (err) {
    console.warn('Failed to show local notification', err);
    recordNotifyDebug({ shown: { at: Date.now(), via, ok: false, error: String(err) } });
  }
};
