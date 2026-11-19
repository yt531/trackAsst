# 輕鬆記推播 Worker（push-worker）

部署在 Cloudflare Workers 的小型服務，負責把「管理員通知」與「公告」透過 FCM 推播到成員的手機或電腦。
網站本身是靜態網站（GitHub Pages），無法執行伺服器程式，所以由這個 Worker 負責發送端。

> 目前只推播兩種事件：**建立管理員通知**、**發佈公告**。
> 不推播：通知被編輯或刪除、公告被取消、交易／分帳／審核／收款等其他通知（這些仍只在 App 內顯示）。

## 運作流程

```
管理員按「發送」
  │ ① App 把通知／公告寫進 Firestore（既有流程）
  │ ② App 把「類型 + 帳本 ID + 文件 ID」與自己的登入憑證傳給 Worker（不傳內容）
  ▼
Worker
  │ ③ 以 Firebase Identity Toolkit 驗證登入憑證，取得 uid
  │ ④ 確認 uid 是該帳本的管理員（admin 或 vice_admin），且是這則通知／公告的發佈人
  │ ⑤ 自己從 Firestore 讀取內容與收件人（通知 = 被標註者；公告 = 全體在籍成員；皆排除發佈人）
  │ ⑥ 逐位收件人讀取 users/{uid}/devices，取得裝置 token
  │ ⑦ 在文件上寫入 pushedAt（以讀取時的 updateTime 當前置條件，防止重複推播）
  │ ⑧ 對每個 token 呼叫 FCM HTTP v1，送出 data 訊息
  ▼
手機的 Service Worker（sw.ts）收到推播並顯示通知
```

**設計重點：Worker 只信任 ID**，內容與收件人一律自己從 Firestore 讀，呼叫端無法偽造推播內容或指定收件人。

## API

`POST /`（只接受設定在 `ALLOWED_ORIGINS` 的網站來源）

標頭：`Authorization: Bearer <Firebase ID token>`、`Content-Type: application/json`

```json
{ "kind": "notice", "ledgerId": "ledger_...", "id": "文件 ID" }
```

`kind` 為 `notice`（管理員通知）或 `announcement`（公告）。

| 狀態 | 意思 |
|---|---|
| 200 `{ ok, sent, failed, cleaned, skipped, skippedRecipients }` | 已處理。`sent` 為成功交給 FCM 的數量 |
| 200 `{ ok, sent: 0, note }` | `no recipients`（沒有收件人）或 `no registered devices`（收件人都沒有登記裝置，不會標記已推播） |
| 400 | 請求格式錯誤，或 ID 含不允許的字元 |
| 401 | 缺少或無效的登入憑證 |
| 403 | 來源不允許、不是帳本管理員、或不是這則的發佈人 |
| 404 | 通知／公告不存在 |
| 409 | 已推播過（或同時有另一個請求搶先認領） |
| 410 | 通知已刪除，或公告已取消／已過期 |
| 405 | 不是 POST（瀏覽器直接開網址會看到這個，代表 Worker 有在運作） |
| 500 | 內部錯誤；`too many recipients` 代表超過請求額度 |

瀏覽器的預檢請求（`OPTIONS`）：來源在白名單內回 204 並帶 CORS 標頭，否則回 403。

推播的 `data`：`title`（`帳本名稱：管理員通知` 或 `帳本名稱：新公告`）、`body`（內容前 100 字）、`url`（動態時報）、`tag`（`notice_<id>` 或 `announcement_<id>`，與 App 內本機通知相同，同時出現時只顯示一則）。

## 設定

非機密設定在 [`wrangler.toml`](wrangler.toml) 的 `[vars]`：

| 變數 | 說明 |
|---|---|
| `PROJECT_ID` | Firebase 專案 ID（`track-asst`） |
| `DATABASE_ID` | Firestore 資料庫 ID（App 使用的具名資料庫，不是 `(default)`） |
| `FIREBASE_API_KEY` | 網頁 API 金鑰（本來就公開在網站中），只用來驗證使用者登入憑證 |
| `ALLOWED_ORIGINS` | 允許呼叫的網站來源，以逗號分隔 |

**機密：`SERVICE_ACCOUNT_JSON`**（服務帳戶金鑰的完整 JSON）只能用 `wrangler secret put` 設定，**絕對不要**寫進 `wrangler.toml`、程式碼、GitHub 或貼在對話裡。

## 第一次部署

需求：Node.js、一個 Cloudflare 帳號（免費方案即可，不需要信用卡）。

1. **建立專用的服務帳戶與金鑰**（Google Cloud 主控台，專案 `track-asst`）
   - IAM 與管理 → 服務帳戶 → 建立，例如 `trackasst-push`。
   - 只授予兩個角色：**Cloud Datastore 使用者**、**Firebase Cloud Messaging API 管理員**。
   - 該服務帳戶 → 金鑰 → 新增金鑰 → JSON，下載檔案，**放在專案資料夾以外**。
   - 若出現「服務帳戶金鑰建立功能已停用」（`iam.disableServiceAccountKeyCreation`），代表組織強制了這項政策。
     請在組織層級給自己「組織政策管理員」角色，再到專案的組織政策頁把該項改為「覆寫上層政策 → 不強制執行」，
     **建完金鑰後記得改回「繼承父項政策」**。
2. **確認 API 已啟用**：Firebase Cloud Messaging API（V1）與 FCM Registration API。
3. **部署 Worker**
   ```powershell
   cd push-worker
   npm install
   npx wrangler login          # 開瀏覽器登入 Cloudflare
   npx wrangler deploy         # 首次會要求註冊 workers.dev 子網域，之後印出 Worker 網址
   ```
4. **上傳金鑰**（Windows PowerShell；路徑換成實際位置）
   ```powershell
   Get-Content "C:\路徑\金鑰檔名.json" -Raw | npx wrangler secret put SERVICE_ACCOUNT_JSON
   ```
   成功後**刪除本機的金鑰檔**，Cloudflare 上已有加密副本。
5. **讓網站知道 Worker 網址**：到 GitHub 專案 → Settings → Secrets and variables → Actions → **Variables**，
   新增 `PUSH_API_URL`，值為 Worker 網址（不含路徑），再重新執行 `Deploy to GitHub Pages` 工作流程。
   （`deploy.yml` 會把它帶進建置時的 `NEXT_PUBLIC_PUSH_API_URL`；沒設定時 App 不會呼叫 Worker，只是不推播。）

## 更新與維護

- **更新程式**：修改 `src/index.ts` 後，在 `push-worker/` 執行 `npx wrangler deploy`（Worker 不會隨網站自動部署）。
- **換金鑰**：在 Google Cloud 建新金鑰 → `wrangler secret put SERVICE_ACCOUNT_JSON` 上傳 → 確認推播正常 →
  回 Google Cloud 刪除舊金鑰 → 刪除本機金鑰檔。
- **型別檢查**：`npm run typecheck`。
- **即時日誌**：`npx wrangler tail`。每次請求會印出一行 `push response <狀態> <結果>`；
  FCM 拒絕發送時會印出 `fcm send failed <狀態> <原因>`。日誌只含狀態與數量，不含金鑰或通知內容。

## 限制（Cloudflare 免費方案，數字以官方現況為準）

- 每次執行最多 **50 個對外請求**。固定開銷約 6～7 個，再加上每位收件人 1 個（讀裝置清單）、1 個認領、
  以及每個裝置 1 個（發送 FCM）。因此一次推播最多處理 **30 位收件人**，實務上收件人加裝置合計約 35 個以內才能全部送達，
  超過的會略過並在回應中以 `skipped`、`skippedRecipients` 回報。
- 每次執行 CPU 時間上限 10 毫秒（等待網路的時間不算）。目前實測沒有超過。
- 費用：Cloudflare Workers 免費方案、Firebase Spark 方案、FCM 皆為免費；推播會用到少量 Firestore 讀取額度。

## 重要的設計決定與踩過的坑

- **為什麼逐位收件人讀裝置，而不是用集合群組查詢？** App 使用的 Firestore 是 **Enterprise 版**資料庫，
  它不支援設定欄位索引（部署索引會回報 `Enterprise Edition does not support updating field index configuration`），
  所以改用不需要索引的一般集合讀取。
- **VAPID 金鑰必須逐字正確。** `NEXT_PUBLIC_FIREBASE_VAPID_KEY`（在 `deploy.yml` 與 `.env.local`）必須與 Firebase 主控台
  專案設定 → 雲端通訊 → 網頁推播憑證 的金鑰組完全一致。曾因數字 `0` 被寫成字母 `O`，
  造成 FCM 註冊 API 對所有請求回傳 `401 UNAUTHENTICATED`（手機端顯示 `messaging/token-subscribe-failed`）。
- **推播只送 `data` 訊息**，由 `sw.ts` 的 `push` 事件決定如何顯示；App 在前景時不彈出，避免與 App 內通知重複。
- **裝置 token 的清理**：登出會刪除該裝置的登記並讓 token 失效；切換帳號只能讓舊 token 失效，
  Worker 之後推播遇到 `UNREGISTERED`（或 404）時會自動刪除對應的裝置紀錄。

## 資料結構

- `users/{uid}/devices/{token}`：`{ userId, token, userAgent, updatedAt }`，由 App 登記（`lib/push.ts`）。
- `ledgers/{ledgerId}/notices/{id}`、`ledgers/{ledgerId}/announcements/{id}`：Worker 會寫入 `pushedAt`（毫秒時間戳）。

## App 端相關檔案

| 檔案 | 作用 |
|---|---|
| `lib/push.ts` | 登記／取消裝置、呼叫 Worker、診斷用的訂閱狀態與紀錄讀取 |
| `sw.ts` | `push` 事件顯示通知、`notificationclick` 開啟頁面；並把收到的事件寫進 Cache Storage 供診斷 |
| `components/ledgers/NoticeBoard.tsx`、`AnnouncementBoard.tsx` | 發送成功後呼叫 `requestPush` |
| `components/settings/NotificationSettings.tsx` | 啟用通知、顯示登記狀態與「進階診斷」 |
| `lib/account.ts` | 登出與切換帳號時清理推播裝置 |
| `.github/workflows/deploy.yml` | 帶入 `NEXT_PUBLIC_PUSH_API_URL` 與 VAPID 金鑰 |

開發環境（`npm run dev`）不會註冊 Service Worker，因此**無法在本機測試推播**，需要部署後在實機上驗證。

## 疑難排解

先到 App 的「設定 → 通知 → 進階診斷」，再對照 `wrangler tail`：

| 現象 | 可能原因 |
|---|---|
| 「背景推播」顯示登記失敗，錯誤含 `token-subscribe-failed` 與 `401` | VAPID 金鑰與 Firebase 主控台不一致（見上），或 FCM Registration API／網站 API 金鑰的 API 限制設定有誤 |
| 診斷顯示「尚無紀錄（推播從未送達）」，但 `tail` 顯示 `sent: 1` | 推播沒到這台裝置的 Service Worker：檢查 Android 的電池最佳化、勿擾模式，以及 Service Worker 版本是否為最新 |
| 診斷顯示 `結果：shown`，卻沒看到通知 | 系統層級擋住：檢查 Android／Chrome 的通知設定 |
| 診斷顯示 `結果：suppressed: app in foreground` | App 正在前景，設計上不重複彈出 |
| `tail` 顯示 `no registered devices` | 收件人沒有登記過裝置（沒啟用通知，或登出過） |
| `tail` 顯示 `409 already pushed` | 這則已推播過，不會重送 |
| `tail` 顯示 `403 not a ledger manager` / `not the author` | 呼叫者不是該帳本管理員，或不是這則的發佈人 |
