'use client';
// Keep the presenter's phone screen awake during the show. Best-effort:
// unsupported browsers / low battery simply no-op. Re-acquires whenever the
// tab returns to the foreground (the lock is auto-released on background).

import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      try {
        const nav = navigator as NavigatorWithWakeLock;
        if (!nav.wakeLock) return;
        const s = await nav.wakeLock.request('screen');
        if (disposed) {
          void s.release().catch(() => undefined);
        } else {
          sentinel = s;
        }
      } catch {
        /* unsupported or denied — non-fatal */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      try {
        void sentinel?.release().catch(() => undefined);
      } catch {
        /* already released */
      }
      sentinel = null;
    };
  }, [active]);
}
