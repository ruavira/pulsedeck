'use client';
// Submission engine for every interactive slide: calls submit_response, retries
// transport failures once automatically, maps server rejections to error codes,
// and persists the acknowledged answer in sessionStorage so a locked/refreshed
// phone restores its "already answered" state. Optimistic UI only AFTER RPC ok.

import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import { haptic } from './bits';

export interface SubmitResult {
  ok: boolean;
  error?: string;
  isCorrect?: boolean | null;
  points?: number;
}

export interface StoredAnswer<P> {
  payload: P;
  result: SubmitResult;
  /** Quiz only: points already added to the local score header (survives refresh). */
  counted?: boolean;
}

export type SubmitStatus = 'idle' | 'sending' | 'submitted' | 'error';

const storeKey = (sessionId: string, slideId: string) => `pd_ans_${sessionId}_${slideId}`;

// Slides answered during THIS page life. A restored answer from a *previous*
// page life has its quiz points already baked into the rejoin score, so it must
// not be re-added to the header at reveal (see hydration below).
const submittedThisLife = new Set<string>();

export function loadAnswer<P>(sessionId: string, slideId: string): StoredAnswer<P> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storeKey(sessionId, slideId));
    return raw ? (JSON.parse(raw) as StoredAnswer<P>) : null;
  } catch {
    return null;
  }
}

function saveAnswer<P>(sessionId: string, slideId: string, answer: StoredAnswer<P>) {
  try {
    sessionStorage.setItem(storeKey(sessionId, slideId), JSON.stringify(answer));
  } catch {
    /* storage full/blocked — in-memory state still works for this page-life */
  }
}

export function useSubmitResponse<P>(opts: {
  sessionId: string;
  slideId: string;
  participantId: string;
  deviceKey: string;
  /** Called when the server says our slide is stale — parent resyncs state. */
  onStale?: () => void;
}) {
  const { sessionId, slideId, participantId, deviceKey } = opts;
  const onStaleRef = useRef(opts.onStale);
  onStaleRef.current = opts.onStale;

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [answer, setAnswer] = useState<StoredAnswer<P> | null>(null);
  const lastPayload = useRef<P | null>(null);
  const answerRef = useRef<StoredAnswer<P> | null>(null);
  answerRef.current = answer;

  // Restore a previously acknowledged answer (phone locked / page refreshed).
  useEffect(() => {
    let saved = loadAnswer<P>(sessionId, slideId);
    if (saved) {
      if (!saved.counted && !submittedThisLife.has(slideId)) {
        // Submitted in an earlier page life — the rejoin score already includes
        // these points; never add them to the header again.
        saved = { ...saved, counted: true };
        saveAnswer(sessionId, slideId, saved);
      }
      setAnswer(saved);
      setStatus('submitted');
    }
  }, [sessionId, slideId]);

  const submit = useCallback(
    async (payload: P): Promise<SubmitResult | null> => {
      lastPayload.current = payload;
      setStatus('sending');
      setErrorCode(null);
      const args = {
        p_session_id: sessionId,
        p_slide_id: slideId,
        p_participant_id: participantId,
        p_device_key: deviceKey,
        p_payload: payload,
        // Client tap time (epoch ms) for best-effort tap→on-screen latency
        // telemetry. The stage sanity-filters it (phones with skewed clocks are
        // simply ignored), so a rough client clock never corrupts the headline
        // server→screen figure.
        p_client_ts: Date.now(),
      };
      let res: SubmitResult | null = null;
      try {
        res = await rpc<SubmitResult>('submit_response', args);
      } catch {
        // One quiet automatic retry for flaky venue networks…
        await new Promise((r) => setTimeout(r, 650));
        try {
          res = await rpc<SubmitResult>('submit_response', args);
        } catch {
          setStatus(answerRef.current ? 'submitted' : 'error');
          setErrorCode('transport');
          return null;
        }
      }
      if (!res || !res.ok) {
        const code = res?.error ?? 'rejected';
        if (code === 'stale_slide') onStaleRef.current?.();
        setStatus(answerRef.current ? 'submitted' : 'error');
        setErrorCode(code);
        return res;
      }
      submittedThisLife.add(slideId);
      haptic(30); // tactile "it landed" on successful vote/answer (no-op on iOS)
      const stored: StoredAnswer<P> = { payload, result: res };
      saveAnswer(sessionId, slideId, stored);
      setAnswer(stored);
      setStatus('submitted');
      return res;
    },
    [sessionId, slideId, participantId, deviceKey],
  );

  /** Re-send the last payload (transport-error retry button). */
  const retry = useCallback(() => {
    if (lastPayload.current !== null) void submit(lastPayload.current);
  }, [submit]);

  /** Quiz: mark this answer's points as already added to the score header. */
  const markCounted = useCallback(() => {
    const cur = answerRef.current;
    if (!cur) return;
    const next = { ...cur, counted: true };
    setAnswer(next);
    saveAnswer(sessionId, slideId, next);
  }, [sessionId, slideId]);

  const clearError = useCallback(() => setErrorCode(null), []);

  return { status, errorCode, answer, submit, retry, markCounted, clearError };
}
