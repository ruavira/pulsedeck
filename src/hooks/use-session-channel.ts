'use client';
// Core realtime hook: subscribes to session:{id}, keeps SessionState in sync,
// resyncs via RPC on every (re)connect, exposes broadcast helpers.
// This is the backbone of live sync — audience, stage and remote all use it.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, rpc } from '@/lib/supabase/client';
import { sessionChannel, type Results, type SessionState } from '@/lib/types';

interface Options {
  /** Called for stage-rebroadcast results events */
  onResults?: (payload: { slideId: string; results: Results }) => void;
  /** Q&A nudge — refetch questions */
  onQaBump?: () => void;
  /** Audience emoji reactions (stage) */
  onReact?: (payload: { emoji: string }) => void;
  /** Audience pace / comprehension signals + raise-hand (stage) */
  onSignal?: (payload: { kind: string }) => void;
  /** Initial state (from join/load) to avoid a flash of loading */
  initialState?: SessionState | null;
}

export function useSessionChannel(sessionId: string | null, opts: Options = {}) {
  const [state, setState] = useState<SessionState | null>(opts.initialState ?? null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const resync = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await rpc<SessionState>('get_session_state', { p_session_id: sessionId });
      if (s) setState((prev) => ({ ...prev, ...s }));
    } catch {
      /* transient — next resync or event will heal */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = getSupabase();
    let disposed = false;

    const channel = supabase
      .channel(sessionChannel(sessionId), { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        setState((prev) => ({ ...prev, ...(payload as SessionState) }));
      })
      .on('broadcast', { event: 'results' }, ({ payload }) => {
        optsRef.current.onResults?.(payload as { slideId: string; results: Results });
      })
      .on('broadcast', { event: 'qa' }, () => optsRef.current.onQaBump?.())
      .on('broadcast', { event: 'react' }, ({ payload }) => {
        optsRef.current.onReact?.(payload as { emoji: string });
      })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        optsRef.current.onSignal?.(payload as { kind: string });
      })
      .subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          void resync(); // heal any missed events after (re)connect
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
        }
      });

    channelRef.current = channel;

    // Belt-and-braces: low-frequency resync poll (jittered) in case a broadcast is missed.
    const interval = setInterval(() => void resync(), 15000 + Math.random() * 5000);

    // Resync when the tab wakes from background (phones lock constantly mid-talk)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, resync]);

  /** Broadcast an event on this session's channel (used by stage aggregator + reactions). */
  const broadcast = useCallback((event: string, payload: unknown) => {
    void channelRef.current?.send({
      type: 'broadcast',
      event,
      payload: payload as Record<string, unknown>,
    });
  }, []);

  return { state, setState, connected, broadcast, resync };
}
