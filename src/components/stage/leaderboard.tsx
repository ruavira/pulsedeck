'use client';
// The ONE big theatrical moment: quiz leaderboard overlay. Top 10 revealed
// bottom-up (#10 first, #1 last) with framer-motion stagger, scores counting up,
// podium accents for the top three. Presenter dismisses with Esc or a click.

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { rpc } from '@/lib/supabase/client';
import type { LeaderboardEntry } from '@/lib/types';
import { Spinner } from '@/components/shared/ui';
import { ConfettiBurst } from './confetti';

function TrophyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[1em] w-[1em] ${className}`} aria-hidden="true">
      <path
        d="M7 4h10v4a5 5 0 01-10 0V4zM7 5H4a3 3 0 003 4M17 5h3a3 3 0 01-3 4M12 13v4m-4 4h8m-6.5-4h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[1em] w-[1em]" aria-hidden="true">
      <path d="M10 2s4.5 3.6 4.5 8a4.5 4.5 0 01-9 0c0-1.6.7-3 1.5-4 0 1.2.7 2 1.5 2C8.5 6.5 10 4.5 10 2z" />
    </svg>
  );
}

/** Animates a number counting up on mount (skipped for reduced motion). */
function CountUp({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) return; // render falls back to the final value directly
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, durationMs, reduced]);

  return <>{(reduced ? value : shown).toLocaleString()}</>;
}

interface PodiumStyle {
  ring: string;
  badge: string;
  label: string;
}
// Gold / silver / bronze accents — rank number + label always shown (never color-only).
const PODIUM: ReadonlyArray<PodiumStyle> = [
  { ring: 'border-amber/70 bg-amber/10', badge: 'bg-amber text-ink', label: '1st place' },
  { ring: 'border-slate/60 bg-slate/10', badge: 'bg-slate text-ink', label: '2nd place' },
  { ring: 'border-amber/40 bg-amber/5', badge: 'bg-amber/60 text-ink', label: '3rd place' },
];

export function Leaderboard({ sessionId, onDismiss }: { sessionId: string; onDismiss: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const reduced = useReducedMotion();

  // Confetti fires the moment #1 lands: the bottom-up stagger means #1's row
  // starts at (n-1) * 0.14s and animates for 0.3s. Skipped under reduced motion.
  useEffect(() => {
    if (reduced || !entries || entries.length === 0) return;
    const landsAtMs = ((entries.length - 1) * 0.14 + 0.3) * 1000;
    const t = window.setTimeout(() => setCelebrate(true), Math.round(landsAtMs));
    return () => window.clearTimeout(t);
  }, [entries, reduced]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const rows = await rpc<LeaderboardEntry[]>('get_leaderboard', {
          p_session_id: sessionId,
          p_limit: 10,
        });
        if (!stop) setEntries(Array.isArray(rows) ? rows : []);
      } catch {
        if (!stop) setError(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  const n = entries?.length ?? 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Quiz leaderboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink/95 px-[6vw] py-[5vh] backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.h2
        initial={reduced ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-[3vh] flex items-center gap-4 text-[clamp(2rem,5vw,3.5rem)] font-bold text-fg"
      >
        <TrophyIcon className="text-amber" /> Leaderboard
      </motion.h2>

      {error && (
        <p className="text-xl text-fg-dim">Couldn&rsquo;t load the leaderboard — press L to try again.</p>
      )}

      {!error && entries === null && (
        <div className="flex items-center gap-3 text-fg-dim">
          <Spinner /> <span className="text-xl">Tallying scores…</span>
        </div>
      )}

      {!error && entries !== null && entries.length === 0 && (
        <p className="text-xl text-fg-dim">No scores yet — run a quiz question first.</p>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <ol className="flex w-full max-w-3xl flex-col gap-[1.2vh]" aria-label="Top players">
          {entries.map((e, i) => {
            const podium: PodiumStyle | undefined = i < PODIUM.length ? PODIUM[i] : undefined;
            // Reveal from the bottom of the board up: #10 first, #1 last.
            const delay = reduced ? 0 : (n - 1 - i) * 0.14;
            return (
              <motion.li
                key={`${i}-${e.nickname}`}
                initial={reduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay, ease: 'easeOut' }}
                className={`flex items-center gap-5 rounded-2xl border px-6 ${
                  i === 0 ? 'py-4' : 'py-2.5'
                } ${podium ? podium.ring : 'border-edge bg-panel'}`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full font-mono font-bold tabular-nums ${
                    podium
                      ? `${podium.badge} ${i === 0 ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-lg'}`
                      : 'h-10 w-10 bg-panel-2 text-base text-fg-dim'
                  }`}
                  aria-label={podium ? podium.label : `Rank ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-semibold text-fg ${
                    i === 0 ? 'text-[clamp(1.6rem,3vw,2.4rem)]' : 'text-[clamp(1.1rem,1.8vw,1.5rem)]'
                  }`}
                >
                  {e.nickname || 'Anonymous'}
                </span>
                {e.streak >= 3 && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-panel-2 px-3 py-1 text-sm font-bold text-amber"
                    aria-label={`${e.streak} answer streak`}
                  >
                    <FlameIcon /> {e.streak}
                  </span>
                )}
                <span
                  className={`shrink-0 font-mono font-bold tabular-nums text-cyan ${
                    i === 0 ? 'text-[clamp(1.6rem,3vw,2.4rem)]' : 'text-[clamp(1.1rem,1.8vw,1.5rem)]'
                  }`}
                >
                  <CountUp value={e.score} durationMs={700 + delay * 1000} />
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}

      <p className="mt-[3vh] text-sm font-medium uppercase tracking-[0.2em] text-fg-dim">
        Click or press Esc to continue
      </p>

      {celebrate && <ConfettiBurst />}
    </motion.div>
  );
}
