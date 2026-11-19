import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache.map(cache => {
      // If it's a navigation cache rule, make sure we don't serve RSC payloads
      if (cache.handler && (cache.handler as any).cacheName === "pages") {
        return {
          ...cache,
          matcher: (options: any) => {
            const { request } = options;
            const isRSC = request.headers.has("RSC") || request.headers.has("Next-Router-Prefetch");
            if (isRSC) return false;
            if (typeof cache.matcher === 'function') {
              return cache.matcher(options);
            }
            return false;
          }
        }
      }
      return cache;
    })
  ],
});

serwist.addEventListeners();

// 診斷紀錄：寫進 Cache Storage，「設定 → 通知」頁可以讀取，用來判斷推播卡在哪個環節
// （Service Worker 無法使用 localStorage，手機也沒有主控台可看）
const DEBUG_CACHE = "push-debug";
const SW_VERSION = "push-diag-1";
const writeDebug = async (key: string, record: Record<string, unknown>) => {
  try {
    const cache = await caches.open(DEBUG_CACHE);
    await cache.put(
      `/__push-debug/${key}`,
      new Response(JSON.stringify(record), { headers: { "Content-Type": "application/json" } })
    );
  } catch {
    // 診斷紀錄失敗不影響推播
  }
};

self.addEventListener("activate", (event) => {
  event.waitUntil(writeDebug("sw", { version: SW_VERSION, activatedAt: Date.now() }));
});

// 接收 FCM 推播（Worker 只送 data 訊息，由這裡決定如何顯示）
self.addEventListener("push", (event) => {
  const record: Record<string, unknown> = { version: SW_VERSION, at: Date.now(), hasData: !!event.data, outcome: "received" };

  event.waitUntil(
    (async () => {
      // 先記一筆「收到」，即使後面處理失敗也知道推播有送達這個 Service Worker
      await writeDebug("push", record);
      try {
        const text = event.data?.text() ?? "";
        record.raw = text.slice(0, 300);
        let payload: { data?: Record<string, string> } & Record<string, string> = {} as never;
        try {
          payload = JSON.parse(text);
        } catch {
          record.parseError = true; // 非 JSON 內容就使用預設標題
        }
        const data: Record<string, string> = payload.data ?? payload;
        const scope = self.registration.scope;

        const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        // App 正在前景時，鈴鐺紅點與 App 內通知已足夠，不重複彈出
        if (windowClients.some((client) => client.visibilityState === "visible" && client.focused)) {
          record.outcome = "suppressed: app in foreground";
          return;
        }
        await self.registration.showNotification(data.title || "輕鬆記", {
          body: data.body || "",
          icon: `${scope}icon-192x192.png`,
          tag: data.tag, // 與 App 內本機通知相同的 tag，同時出現時只顯示一則
          data: { url: new URL((data.url || "").replace(/^\//, ""), scope).href },
        });
        record.outcome = "shown";
      } catch (err) {
        record.outcome = `error: ${String(err)}`;
      } finally {
        await writeDebug("push", record);
      }
    })()
  );
});

// 點擊系統通知：已有開啟的視窗就切過去並導向對應頁面，否則開新視窗
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      const existing = windowClients[0];
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })
  );
});
