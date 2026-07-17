'use client';
// Low-frequency polling hooks for the remote. The remote is a single client
// (one presenter), so these RPC polls add O(1) load — far below the stage
// aggregator's cadence. Errors are swallowed; the next tick heals.

import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import type { Results } from '@/lib/types';

/** Participant count for the status bar (default every 5s + jitter). */
export function useRemoteParticipantCount(
  sessionId: string | null,
  intervalMs = 5000,
): number | null {
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

/**
 * Live response total for the current interactive slide.
 * Polls get_results every 3s while voting is open, every 10s otherwise.
 * Pass slideId=null to pause entirely (content slides, lobby, ended).
 */
export function useResponseTotal(
  sessionId: string,
  slideId: string | null,
  fast: boolean,
): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    setTotal(null);
  }, [slideId]);

  useEffect(() => {
    if (!slideId) return;
    let stop = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await rpc<Results>('get_results', {
          p_session_id: sessionId,
          p_slide_id: slideId,
        });
        if (!stop && r && typeof r.total === 'number') setTotal(r.total);
      } catch {
        /* transient — next tick retries */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), (fast ? 3000 : 10000) + Math.random() * 400);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [sessionId, slideId, fast]);

  return total;
}
