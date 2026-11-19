// 由前景頁面在 App 位於背景時顯示系統通知，不需要伺服器。
// 限制：App 完全關閉（或被手機系統凍結）時收不到，那需要真正的推播（FCM 發送端）。
export const showLocalNotification = async (
  title: string,
  body: string,
  options: { link?: string; tag?: string } = {},
) => {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
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
      await registration.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
  } catch (err) {
    console.warn('Failed to show local notification', err);
  }
};
