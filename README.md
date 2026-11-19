# Track Assistant

**Track Assistant** 是一個以 Next.js 打造的現代化 AI 發票與記帳追蹤儀表板。它運用 Gemini API 進行智慧處理，以 Firebase 提供後端服務，並完整設定為漸進式網頁應用程式（PWA）。

## 🚀 主要功能

*   **智慧 AI 整合**：使用 Google GenAI（`@google/genai`）提供智慧洞察與自動化處理。
*   **現代化技術堆疊**：以 Next.js 15、React 19 與 Tailwind CSS 打造。
*   **互動式儀表板**：
    *   **資料視覺化**：整合 `recharts` 製作圖表與分析。
    *   **拖曳排序**：由 `@dnd-kit` 驅動的看板式或可排序清單。
    *   **日期篩選**：由 `react-flatpickr` 驅動、高度可自訂的 `DatePicker` 元件。
*   **實用工具**：
    *   **QR Code 掃描**：內建以 `jsqr` 掃描 QR Code 的支援。
    *   **Excel 匯出**：使用 `xlsx` 輕鬆將追蹤資料與發票匯出為 Excel。
*   **支援 PWA**：透過 `@serwist/next` 提供離線支援，並可安裝到裝置上。
*   **流暢動畫**：以 Framer Motion（`motion`）帶來順暢的使用體驗。
*   **雲端後端**：由 Firebase 提供即時資料庫與穩固的身分驗證。

## 🛠️ 事前準備

*   **Node.js**（建議 v18 或更新版本）
*   **Firebase 帳號**（用於設定資料庫與身分驗證）
*   **Google Gemini API 金鑰**（用於 AI 功能）

## 💻 開始使用

1.  **複製專案並安裝相依套件：**

    ```bash
    npm install
    ```

2.  **設定環境變數：**

    請將你的 `GEMINI_API_KEY` 加入 `.env.local`：
    ```env
    GEMINI_API_KEY=your_api_key_here
    # 如有需要，也請在此加入 Firebase 設定金鑰
    ```

3.  **啟動開發伺服器：**

    ```bash
    npm run dev
    ```

4.  **開啟應用程式：**
    在瀏覽器前往 [http://localhost:3000](http://localhost:3000)。

## 📦 正式環境建置

建立最佳化的正式環境版本：

```bash
npm run build
npm start
```

## 🧹 程式碼品質

本專案使用 ESLint 與 TypeScript 確保型別安全與程式碼品質。你可以執行以下指令檢查程式碼檢查（lint）錯誤：

```bash
npm run lint
```
