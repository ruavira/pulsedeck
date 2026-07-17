'use client';
// STAGE-ONLY results aggregation. The stage view is the single poller so database
// load is O(1) in audience size. It rebroadcasts compact results (throttled) for
// audience screens that show live results.

import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import type { Results } from '@/lib/types';

const FAST_MS = 700; // while voting is open
const SLOW_MS = 2500; // otherwise
const REBROADCAST_MIN_MS = 1500;

/** One respond→on-screen latency measurement, computed at the stage on receipt. */
export interface LatencySample {
  /**
   * Server-clock ms from the moment the newest response was *recorded* to the
   * moment the stage received it in this poll. Skew-clean (both ends normalized
   * to the server clock). This is the reliable headline figure.
   */
  serverToScreenMs: number;
  /**
   * Approximate tap→on-screen ms, using the phone's reported tap time. Only
   * present (and only trusted) when the phone's clock looks sane; omitted
   * otherwise. Labeled approximate because it depends on the phone's clock.
   */
  endToEndMs?: number;
  /** Local time of this measurement (for the rolling HUD). */
  at: number;
}

export function useResultsPoller(
  sessionId: string | null,
  slideId: string | null,
  active: boolean, // slide is interactive and phase is open/closed/reveal
  open: boolean, // phase === 'open'
  rebroadcast?: (payload: { slideId: string; results: Results }) => void,
  skewMs = 0, // stage clock skew vs server (for latency telemetry)
  onLatency?: (sample: LatencySample) => void,
) {
  const [results, setResults] = useState<Results | null>(null);
  const lastBroadcast = useRef(0);
  const inFlight = useRef(false);
  // Keep latest skew/callback in refs so the poll interval isn't torn down when
  // clock-skew updates or the parent passes a fresh callback identity.
  const skewRef = useRef(skewMs);
  const onLatencyRef = useRef(onLatency);
  skewRef.current = skewMs;
  onLatencyRef.current = onLatency;

  useEffect(() => {
    setResults(null);
  }, [slideId]);

  useEffect(() => {
    if (!sessionId || !slideId || !active) return;
    let stop = false;

    const tick = async () => {
      if (stop || inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await rpc<Results>('get_results', {
          p_session_id: sessionId,
          p_slide_id: slideId,
        });
        if (!stop && r) {
          setResults(r);
          const now = Date.now();
          // Latency telemetry: measure respond→on-screen at the moment fresh
          // data lands. serverNow (stage clock normalized to the server clock)
          // minus the server-recorded time of the newest response = the delay a
          // presenter actually perceives. Skew-clean because both are server-clock.
          if (onLatencyRef.current && r.lastResponseAt) {
            const serverNow = now + skewRef.current;
            const recordedAt = Date.parse(r.lastResponseAt);
            if (Number.isFinite(recordedAt)) {
              const serverToScreenMs = Math.round(serverNow - recordedAt);
              // Only report plausible positive lapses (guards clock oddities and
              // bulk-inserted synthetic rows that predate this poll cycle).
              if (serverToScreenMs >= 0 && serverToScreenMs < 60_000) {
                const sample: LatencySample = { serverToScreenMs, at: now };
                // End-to-end (tap→screen) when the phone reported a sane tap time.
                if (typeof r.lastClientTs === 'number') {
                  const e2e = Math.round(serverNow - r.lastClientTs);
                  if (e2e >= serverToScreenMs && e2e < 120_000) sample.endToEndMs = e2e;
                }
                onLatencyRef.current(sample);
                if (typeof console !== 'undefined') {
                  console.info(
                    `[pd-latency] server→screen=${serverToScreenMs}ms` +
                      (sample.endToEndMs != null ? ` tap→screen≈${sample.endToEndMs}ms` : ''),
                  );
                }
              }
            }
          }
          if (rebroadcast && now - lastBroadcast.current >= REBROADCAST_MIN_MS) {
            lastBroadcast.current = now;
            rebroadcast({ slideId, results: r });
          }
        }
      } catch {
        /* transient; next tick retries */
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const base = open ? FAST_MS : SLOW_MS;
    const interval = setInterval(() => void tick(), base + Math.random() * 200);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [sessionId, slideId, active, open, rebroadcast]);

  return results;
}
