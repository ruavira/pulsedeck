'use client';
// PulseDeck Embeds — deck-scoped live-session resolver.
//
// Embeds are addressed by DECK (paste-once URL that works every session), so this
// hook resolves a deckId to whatever session is live *right now* via the public,
// read-only get_live_session_for_deck RPC. While nothing is live it re-polls with
// a little jitter and exposes a `live:false` pre-live state. Once a session is
// live it subscribes to the session channel (use-session-channel) so `state`
// broadcasts keep phase / slide index fresh without re-polling the resolver; the
// resolver is only re-fetched when the slide index changes (to pull the new
// slide's public content) or a session ends and the next one starts. Presence and
// results wiring are passed straight through so the embed keeps ONE channel.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePresenceState } from '@supabase/supabase-js';
import { rpc } from '@/lib/supabase/client';
import type { Phase, Results, SessionStatus, SlideKind } from '@/lib/types';
import { useSessionChannel, type PresenceIdentity } from './use-session-channel';

/** Public-safe slide shape returned by get_live_session_for_deck (no answers/PII). */
export interface EmbedSlide {
  id: string;
  kind: SlideKind;
  title?: string;
  body: {
    prompt?: string;
    options?: string[];
    optionImages?: string[];
    // Scale axis (public — shown on the projector's scale slide).
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
  };
  settings: { timeLimitSec?: number };
}

interface ResolvedSession {
  session_id: string;
  code: string;
  phase: Phase;
  status: SessionStatus;
  current_slide_index: number;
  participant_count: number;
  current_slide: EmbedSlide | null;
}

interface Options {
  presence?: PresenceIdentity;
  onPresenceSync?: (state: RealtimePresenceState) => void;
  onResults?: (payload: { slideId: string; results: Results }) => void;
  onReact?: (payload: { emoji: string }) => void;
  onSignal?: (payload: { kind: string }) => void;
  onQaBump?: (payload?: { action?: string }) => void;
}

export interface EmbedSession {
  /** A session is live for this deck right now. */
  live: boolean;
  /** First resolve hasn't completed yet (avoid a flash of the pre-live state). */
  loading: boolean;
  /** The live session has ended (distinct from pre-live). */
  ended: boolean;
  sessionId: string | null;
  code: string | null;
  phase: Phase | null;
  status: SessionStatus | null;
  currentSlide: EmbedSlide | null;
  currentSlideIndex: number | null;
  participantCount: number | null;
  connected: boolean;
  /** Increments on each `qa` broadcast nudge so an embedded Q&A wall refetches live. */
  qaBump: number;
  /** Broadcast on the session channel (used to rebroadcast aggregated results). */
  broadcast: (event: string, payload: unknown) => void;
}

export function useEmbedSession(deckId: string, opts: Options = {}): EmbedSession {
  const [resolved, setResolved] = useState<ResolvedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedRef = useRef<ResolvedSession | null>(null);
  resolvedRef.current = resolved;

  const sessionId = resolved?.session_id ?? null;

  // Q&A nudge: bump a counter on each `qa` broadcast so the embedded Q&A wall
  // refetches immediately rather than waiting for its own poll.
  const [qaBump, setQaBump] = useState(0);
  const externalOnQaBump = opts.onQaBump;
  const onQaBump = useCallback((payload?: { action?: string }) => {
    setQaBump((n) => n + 1);
    externalOnQaBump?.(payload);
  }, [externalOnQaBump]);

  const { state: channelState, connected, broadcast } = useSessionChannel(sessionId, {
    onResults: opts.onResults,
    onQaBump,
    onReact: opts.onReact,
    onSignal: opts.onSignal,
    presence: opts.presence,
    onPresenceSync: opts.onPresenceSync,
  });

  const fetchResolver = useCallback(async (): Promise<ResolvedSession | null> => {
    if (!deckId) return null;
    try {
      return (await rpc<ResolvedSession | null>('get_live_session_for_deck', {
        p_deck_id: deckId,
      })) ?? null;
    } catch {
      return null; // transient — next poll / event heals
    }
  }, [deckId]);

  // Effective live fields: the channel `state` broadcast is authoritative during a
  // live run; the resolver is the fallback / initial value.
  const status = (channelState?.status ?? resolved?.status ?? null) as SessionStatus | null;
  const phase = (channelState?.phase ?? resolved?.phase ?? null) as Phase | null;
  const currentSlideIndex = channelState?.currentSlideIndex ?? resolved?.current_slide_index ?? null;
  const ended = status === 'ended';
  const live = !!resolved && !ended && status === 'live';

  // --- Search for a live session while none is running (pre-live), and again
  //     after one ends so a deck embed picks up the next session automatically. ---
  const searching = !resolved || ended;
  useEffect(() => {
    if (!deckId || !searching) return;
    let stop = false;
    const tick = async () => {
      const r = await fetchResolver();
      if (stop) return;
      setLoading(false);
      if (r && r.session_id !== resolvedRef.current?.session_id) {
        setResolved(r); // a (new) session is live — switch to it
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5000 + Math.random() * 1500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [deckId, searching, fetchResolver]);

  // --- Refresh the current slide's public content when the slide index changes. ---
  // Phase toggles (open/close/reveal) arrive on the channel and need no refetch;
  // only a slide change requires pulling the new slide's public fields.
  const lastFetchedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    if (!live) return;
    const idx = channelState?.currentSlideIndex;
    if (idx == null) return;
    if (idx === resolvedRef.current?.current_slide_index) {
      lastFetchedIndexRef.current = idx;
      return;
    }
    if (lastFetchedIndexRef.current === idx) return;
    lastFetchedIndexRef.current = idx;
    let stop = false;
    void (async () => {
      const r = await fetchResolver();
      if (stop || !r || r.session_id !== resolvedRef.current?.session_id) return;
      setResolved(r);
    })();
    return () => {
      stop = true;
    };
  }, [live, channelState?.currentSlideIndex, fetchResolver]);

  return {
    live,
    loading,
    ended,
    sessionId,
    code: resolved?.code ?? null,
    phase,
    status,
    currentSlide: resolved?.current_slide ?? null,
    currentSlideIndex,
    participantCount: resolved?.participant_count ?? null,
    connected,
    qaBump,
    broadcast,
  };
}
