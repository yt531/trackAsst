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

// 接收 FCM 推播（Worker 只送 data 訊息，由這裡決定如何顯示）
self.addEventListener("push", (event) => {
  let payload: { data?: Record<string, string> } & Record<string, string> = {} as never;
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // 非 JSON 內容就使用預設標題
  }
  const data: Record<string, string> = payload.data ?? payload;
  const scope = self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // App 正在前景時，鈴鐺紅點與 App 內通知已足夠，不重複彈出
      if (windowClients.some((client) => client.visibilityState === "visible" && client.focused)) return;
      return self.registration.showNotification(data.title || "輕鬆記", {
        body: data.body || "",
        icon: `${scope}icon-192x192.png`,
        tag: data.tag, // 與 App 內本機通知相同的 tag，同時出現時只顯示一則
        data: { url: new URL((data.url || "").replace(/^\//, ""), scope).href },
      });
    })
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
