---
name: commit-zh
description: 使用中文撰寫符合專案規範的 git commit message
triggers: ["commit", "git commit"]
---

# 任務
產生符合以下規範的中文 commit message:
- 首行 50 字內,開頭用 feat / fix / docs / refactor / chore
- 空一行後寫詳細說明,每行 72 字內
- 說明要有「為什麼改」不只是「改了什麼」
- 結尾加 Co-Authored-By 如果是協作