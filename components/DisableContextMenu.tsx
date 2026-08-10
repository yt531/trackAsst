'use client';

import { useEffect } from 'react';

// 白名單列表：請在此陣列中新增或修改允許使用右鍵的網域或 IP
const ALLOWED_HOSTS = ['localhost', '192.168.56.1'];

export function DisableContextMenu() {
  useEffect(() => {
    // 如果目前的 hostname 在白名單內，則不執行阻擋邏輯
    if (ALLOWED_HOSTS.includes(window.location.hostname)) {
      return;
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return null;
}
