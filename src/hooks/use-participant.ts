'use client';
// Audience identity: stable device_key in localStorage + join/rejoin logic.
// Rejoining with the same device_key is idempotent (server upserts), so a phone
// that locks, drops wifi, or refreshes keeps its identity, score, and votes.

import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import type { JoinResult } from '@/lib/types';

const DEVICE_KEY = 'pd_device_key';
const NICK_KEY = 'pd_nickname';

export function getDeviceKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  let key = localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}

export function getSavedNickname(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(NICK_KEY) ?? '';
}

export function useParticipant(code: string | null) {
  const [join, setJoin] = useState<JoinResult | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doJoin = useCallback(
    async (nickname: string) => {
      if (!code) return null;
      setJoining(true);
      setError(null);
      try {
        const res = await rpc<JoinResult>('join_session', {
          p_code: code,
          p_nickname: nickname,
          p_device_key: getDeviceKey(),
        });
        if (!res.ok) {
          setError(
            res.error === 'not_found'
              ? 'No live session found for that code.'
              : res.error === 'locked'
                ? 'locked'
                : res.error === 'full'
                  ? 'This session is full — the host has reached their plan’s participant limit.'
                  : 'Could not join.',
          );
          return null;
        }
        localStorage.setItem(NICK_KEY, nickname);
        setJoin(res);
        return res;
      } catch {
        setError('Connection problem — try again.');
        return null;
      } finally {
        setJoining(false);
      }
    },
    [code],
  );

  // Auto-rejoin if we already have a nickname saved (seamless reconnect path)
  useEffect(() => {
    if (!code || join) return;
    const saved = getSavedNickname();
    if (saved) void doJoin(saved);
  }, [code, join, doJoin]);

  return { join, joining, error, doJoin, deviceKey: getDeviceKey() };
}
