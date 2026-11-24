import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16 已直接提供 flat config，不需再經 FlatCompat 轉換
// （轉換會因 plugin 循環參照而出現 "Converting circular structure to JSON"）
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];

export default eslintConfig;
