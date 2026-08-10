'use client';

import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import React, { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';

// === 白名單設定區塊 ===
// 在這裡加入允許顯示網址預覽的域名或 IP
const PREVIEW_WHITELIST = [
  'localhost',
  '127.0.0.1',
  '192.168.56.1',
];
// =====================

type NextLinkProps = ComponentProps<typeof NextLink>;

export function HiddenLink({ href, children, className, onClick, ...props }: NextLinkProps) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (PREVIEW_WHITELIST.includes(hostname)) {
        setShowPreview(true);
      }
    }
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (onClick) {
      onClick(e);
    }
    
    // 如果不是白名單，我們手動處理導覽
    if (!showPreview) {
      e.preventDefault();
      router.push(href.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (!showPreview && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      router.push(href.toString());
    }
  };

  // 為了避免 hydration mismatch，在 mounted 之前統一回傳隱藏版本的 Link
  if (mounted && showPreview) {
    return (
      <NextLink href={href} className={className} onClick={onClick} {...props}>
        {children}
      </NextLink>
    );
  }

  // 非白名單，隱藏 href 以避免左下角出現預覽
  return (
    <a
      role="button"
      tabIndex={0}
      className={`cursor-pointer ${className || ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...(props as any)}
    >
      {children}
    </a>
  );
}
