import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16 已直接提供 flat config，不需再經 FlatCompat 轉換
// （轉換會因 plugin 循環參照而出現 "Converting circular structure to JSON"）
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // React 19 新規則：只是效能提醒，專案內有大量「載入時抓資料」「掛載旗標」等常見寫法，
      // 先降為警告，避免淹沒真正的錯誤；日後逐步重構後可改回 error
      "react-hooks/set-state-in-effect": "warn"
    }
  }
];

export default eslintConfig;
