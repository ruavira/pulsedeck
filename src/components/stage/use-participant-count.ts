'use client';
// Polls get_participant_count on an interval (stage chrome: 5s, lobby: faster
// so the join wave visibly ticks up). Errors are swallowed — next tick heals.

import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase/client';

export function useParticipantCount(sessionId: string | null, intervalMs = 5000): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;

    const tick = async () => {
      try {
        const n = await rpc<number>('get_participant_count', { p_session_id: sessionId });
        if (!stop && typeof n === 'number') setCount(n);
      } catch {
        /* transient — next tick retries */
      }
    };

    void tick();
    const id = setInterval(() => void tick(), intervalMs + Math.random() * 500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [sessionId, intervalMs]);

  return count;
}
