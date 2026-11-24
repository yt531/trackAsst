// App 內的提示訊息，取代瀏覽器內建的 alert()。
// 手機瀏覽器、PWA 會靜默擋掉內建對話框，造成失敗訊息完全看不到；
// 改由 App 自己繪製提示（components/ToastHost.tsx）就不會有這個問題。
//
// 用法：showToast('儲存失敗');（不會阻塞，不需要 async）
// 接著要 reload 或整頁跳轉時：await showToast('已新增', 1500);（等提示消失後再繼續）

export interface ToastRequest {
  id: number;
  message: string;
  duration: number;
  resolve: () => void;
}

let host: ((request: ToastRequest) => void) | null = null;
let nextId = 1;

export const registerToastHost = (handler: (request: ToastRequest) => void) => {
  host = handler;
  return () => {
    if (host === handler) host = null;
  };
};

// 預設顯示時間依字數增加，最長 8 秒
const defaultDuration = (message: string) => Math.min(8000, 3000 + message.length * 60);

export const showToast = (message: string, duration = defaultDuration(message)): Promise<void> =>
  new Promise(resolve => {
    if (!host) {
      // 提示元件尚未掛載時的保底
      window.alert(message);
      resolve();
      return;
    }
    host({ id: nextId++, message, duration, resolve });
  });
