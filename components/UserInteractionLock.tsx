'use client';

import { useEffect } from 'react';

export function UserInteractionLock() {
  useEffect(() => {
    // 阻擋右鍵選單 (全域無條件攔截)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 阻擋開發人員工具快捷鍵 (全域無條件攔截)
    const handleKeyDown = (e: KeyboardEvent) => {
      // 攔截 F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // 攔截 Ctrl+Shift+I / Cmd+Option+I (開發人員工具)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
      }
      // 攔截 Ctrl+Shift+J / Cmd+Option+J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
      }
      // 攔截 Ctrl+Shift+C / Cmd+Option+C (元素檢查)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
      }
      // 攔截 Ctrl+U / Cmd+Option+U (檢視原始碼)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
      }
    };

    // 阻擋複製、剪下、貼上，但允許輸入框
    const handleCopyCutPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return; // 允許輸入框顯示右鍵選單 (不過右鍵已全域阻擋，這裡只允許快捷鍵如 Ctrl+C/Ctrl+V)
      }
      e.preventDefault();
    };

    // 阻擋文字選取起點，確保 JavaScript 層級的防護 (允許輸入框選取文字)
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  return null;
}
