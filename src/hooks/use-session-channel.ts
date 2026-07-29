'use client';
// Core realtime hook: subscribes to session:{id}, keeps SessionState in sync,
// resyncs via RPC on every (re)connect, exposes broadcast helpers.
// This is the backbone of live sync — audience, stage and remote all use it.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { getSupabase, rpc } from '@/lib/supabase/client';
import { sessionChannel, type Results, type SessionState } from '@/lib/types';

/** Realtime Presence identity advertised on the session channel. Stable per tab. */
export interface PresenceIdentity {
  /** Stable per-tab key — presence entries are keyed by this. */
  key: string;
  /** Advertised role: 'stage' | 'embed'. Drives aggregator election. */
  role: string;
}

interface Options {
  /** Called for stage-rebroadcast results events */
  onResults?: (payload: { slideId: string; results: Results }) => void;
  /** Q&A nudge — refetch questions */
  onQaBump?: (payload?: { action?: string }) => void;
  /** Audience emoji reactions (stage) */
  onReact?: (payload: { emoji: string }) => void;
  /** Audience pace / comprehension signals + raise-hand (stage) */
  onSignal?: (payload: { kind: string }) => void;
  /** Initial state (from join/load) to avoid a flash of loading */
  initialState?: SessionState | null;
  /**
   * When set, this client registers Realtime Presence on the channel with the
   * given identity (tracked on every (re)subscribe). Used by the stage (role
   * 'stage') and by embeds (role 'embed') so embeds can elect a single results
   * aggregator and always defer to a live stage. Stable per mount.
   */
  presence?: PresenceIdentity;
  /** Presence snapshot changed (sync/join/leave) — receives the full state. */
  onPresenceSync?: (state: RealtimePresenceState) => void;
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
    // Presence identity is stable per mount — safe to read once at channel setup.
    const presence = optsRef.current.presence;

    const channel = supabase.channel(sessionChannel(sessionId), {
      config: {
        broadcast: { self: true },
        ...(presence ? { presence: { key: presence.key } } : {}),
      },
    });

    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        setState((prev) => ({ ...prev, ...(payload as SessionState) }));
      })
      .on('broadcast', { event: 'results' }, ({ payload }) => {
        optsRef.current.onResults?.(payload as { slideId: string; results: Results });
      })
      .on('broadcast', { event: 'qa' }, ({ payload }) => {
        optsRef.current.onQaBump?.(payload as { action?: string });
      })
      .on('broadcast', { event: 'react' }, ({ payload }) => {
        optsRef.current.onReact?.(payload as { emoji: string });
      })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        optsRef.current.onSignal?.(payload as { kind: string });
      });

    // Presence binding must be registered BEFORE subscribe so the join enables
    // presence for this member. Emit the full snapshot on every change. We bind
    // join/leave in addition to sync so aggregator handoff fires the moment the
    // current poller's tab disconnects — not reliant on `sync` also emitting on
    // leave (which varies by client version).
    if (presence) {
      const emitSnapshot = () => optsRef.current.onPresenceSync?.(channel.presenceState());
      channel.on('presence', { event: 'sync' }, emitSnapshot);
      channel.on('presence', { event: 'join' }, emitSnapshot);
      channel.on('presence', { event: 'leave' }, emitSnapshot);
    }

    channel.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        if (presence) {
          void channel.track({ clientId: presence.key, role: presence.role, ts: Date.now() });
        }
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
