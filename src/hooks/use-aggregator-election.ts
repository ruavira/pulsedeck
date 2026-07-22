'use client';
// Aggregator election for PulseDeck Embeds — the robustness core.
//
// Contract (ARCHITECTURE.md "Realtime topology"): exactly ONE client per session
// polls get_results and rebroadcasts throttled `results`; everyone else consumes.
// The real stage is that poller during a normal talk. Embeds must NEVER add a
// second poller. But an embed may be running with NO stage open (presenter driving
// from the phone remote, or the deck embedded on a page nobody is projecting), and
// the room still deserves live results. So embeds elect a single aggregator among
// themselves — deterministically, from the shared Realtime Presence snapshot, so
// every client computes the same winner and exactly one ends up polling.
//
// Rules:
//   - If ANY member has role 'stage', the stage is the aggregator → this embed
//     never polls (returns false).
//   - Otherwise the present 'embed' with the lexicographically smallest clientId
//     wins. Same snapshot → same winner everywhere → one poller.
// Hysteresis: only (re)claim/relinquish after presence has been stable ~750ms, so
// a flurry of joins/leaves (a projector opening, tabs refreshing) doesn't churn the
// poller. Consumers keep rendering last-known results throughout, so handoff is
// flicker-free; the winner's poller does an immediate leading fetch on activation
// (see use-results-poller), keeping the results stream gap-free.

import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { RealtimePresenceState } from '@supabase/supabase-js';

const STABILITY_MS = 750;

interface PresenceMeta {
  clientId?: string;
  role?: string;
}

/** Deterministic winner from a presence snapshot — pure, no side effects. */
function isAggregatorFor(state: RealtimePresenceState | null, myClientId: string): boolean {
  if (!state) return false;
  const members: PresenceMeta[] = [];
  for (const key of Object.keys(state)) {
    for (const m of state[key] as unknown as PresenceMeta[]) members.push(m);
  }
  // A live stage always owns aggregation — embeds defer unconditionally.
  if (members.some((m) => m.role === 'stage')) return false;
  const embedIds = members
    .filter((m) => m.role === 'embed' && typeof m.clientId === 'string')
    .map((m) => m.clientId as string);
  if (embedIds.length === 0) return false; // our own track hasn't synced back yet
  let winner = embedIds[0];
  for (const id of embedIds) if (id < winner) winner = id;
  return winner === myClientId;
}

export function useAggregatorElection(presenceState: RealtimePresenceState | null): {
  isAggregator: boolean;
  clientId: string;
} {
  // Stable per-tab identity — generated once, never regenerated (client-only).
  const clientIdRef = useRef<string>('');
  if (clientIdRef.current === '') clientIdRef.current = `embed-${nanoid(12)}`;
  const clientId = clientIdRef.current;

  const [isAggregator, setIsAggregator] = useState(false);
  const committedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = isAggregatorFor(presenceState, clientId);
    // Already where we want to be — cancel any pending flip and stay put.
    if (target === committedRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    // Debounce the change: only commit once presence has held ~750ms.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      committedRef.current = target;
      setIsAggregator(target);
      timerRef.current = null;
    }, STABILITY_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [presenceState, clientId]);

  return { isAggregator, clientId };
}
