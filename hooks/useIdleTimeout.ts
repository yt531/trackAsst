import { useEffect, useRef } from 'react';

type UseIdleTimeoutOptions = {
  timeoutMs: number;
  onIdle: () => void;
  enabled?: boolean;
};

export function useIdleTimeout({ timeoutMs, onIdle, enabled = true }: UseIdleTimeoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return;

    const handleActivity = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onIdle();
      }, timeoutMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Option to lock immediately when hidden, or just let timeout handle it
        // We'll let timeout handle it, but maybe reset timer on hidden
      }
      handleActivity();
    };

    // Initial setup
    handleActivity();

    // Event listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeoutMs, onIdle, enabled]);
}
