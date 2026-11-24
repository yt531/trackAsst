// App 內的確認對話框，取代瀏覽器內建的 confirm()。
// 某些手機瀏覽器、PWA 或內嵌瀏覽器會靜默擋掉內建對話框（直接回傳「否」），
// 造成按鈕按下去完全沒反應；改由 App 自己繪製視窗（components/ConfirmHost.tsx）就不會有這個問題。
//
// 用法：if (!(await confirmAsync('確定要刪除嗎？'))) return;（呼叫處必須是 async 函式）

export interface ConfirmRequest {
  message: string;
  resolve: (confirmed: boolean) => void;
}

let host: ((request: ConfirmRequest) => void) | null = null;

export const registerConfirmHost = (handler: (request: ConfirmRequest) => void) => {
  host = handler;
  return () => {
    if (host === handler) host = null;
  };
};

export const confirmAsync = (message: string): Promise<boolean> =>
  new Promise(resolve => {
    if (!host) {
      // 視窗元件尚未掛載時的保底
      resolve(window.confirm(message));
      return;
    }
    host({ message, resolve });
  });
