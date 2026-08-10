'use client';

import { useEffect } from 'react';

export function UserInteractionLock() {
  useEffect(() => {
    // 阻擋右鍵選單，但允許在輸入框上使用（以便使用者可以貼上）
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return; // 允許輸入框顯示右鍵選單
      }
      e.preventDefault();
    };

    // 阻擋複製、剪下、貼上，但允許輸入框
    const handleCopyCutPaste = (e: ClipboardEvent) => {
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

    // 阻擋文字選取起點，確保 JavaScript 層級的防護
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
    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  return null;
}
