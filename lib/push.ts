import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { app, auth, db } from './firebase';

export type PushRegisterResult = 'ok' | 'denied' | 'unsupported' | 'no-service-worker' | 'no-vapid-key';

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([promise, new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms))]);

// 沿用 App 本身的 Service Worker（sw.ts）接收推播；開發環境沒有註冊 SW，無法使用推播
const getServiceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) return undefined;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return undefined;
  await navigator.serviceWorker.ready;
  return registration;
};

// 取得這台裝置的推播 token，並登記到 users/{uid}/devices/{token}（可重複呼叫，不會產生重複紀錄）
export const registerPushDevice = async (uid: string): Promise<PushRegisterResult> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return 'no-vapid-key';

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return 'unsupported';
  const registration = await getServiceWorkerRegistration();
  if (!registration) return 'no-service-worker';

  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return 'unsupported';
  await setDoc(doc(db, 'users', uid, 'devices', token), {
    userId: uid,
    token,
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: Date.now(),
  }, { merge: true });
  return 'ok';
};

// 讓這台裝置不再收到目前帳號的推播：
// 傳入 uid（仍在登入狀態）時一併刪除裝置紀錄；不傳則只讓 token 失效，
// Worker 之後推播失敗時會自動清掉對應的裝置紀錄。失敗不會中斷登出或切換。
export const unregisterPushDevice = async (uid?: string) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const { getMessaging, getToken, deleteToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return;
    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const registration = await getServiceWorkerRegistration();
    if (!registration) return;

    if (uid && vapidKey && Notification.permission === 'granted') {
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      // 離線時寫入會一直等待，設定逾時避免卡住登出
      if (token) await withTimeout(deleteDoc(doc(db, 'users', uid, 'devices', token)), 3000);
    }
    await deleteToken(messaging);
  } catch (err) {
    console.warn('Failed to unregister push device', err);
  }
};

// 通知推播 Worker：只傳通知/公告的 ID，內容與收件人由 Worker 自己從 Firestore 讀取。
// 推播是附加功能，失敗不影響原本的發送。
export const requestPush = async (kind: 'notice' | 'announcement', ledgerId: string, id: string) => {
  const endpoint = process.env.NEXT_PUBLIC_PUSH_API_URL;
  if (!endpoint) return;
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ledgerId, id }),
    });
    if (!res.ok) console.warn('Push request failed', res.status, await res.text());
  } catch (err) {
    console.warn('Push request failed', err);
  }
};
