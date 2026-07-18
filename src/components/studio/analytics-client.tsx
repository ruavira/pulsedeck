'use client';
// /studio/analytics — cross-session trainer analytics: engagement trend,
// question difficulty (item stats) and returning-learner progress. All values
// are always rendered as text alongside any bar/spark visual (never
// color-only), tables carry real semantics, and the whole page re-skins with
// the theme tokens.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Pill, Spinner } from '@/components/shared/ui';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { relativeTime } from './studio-api';

interface Analytics {
  totals: {
    decks: number;
    sessions: number;
    participants: number;
    responses: number;
    returningLearners: number;
    lastSessionAt: string | null;
  };
  trend: { weekStart: string; sessions: number; participants: number }[];
  decks: {
    id: string;
    title: string;
    sessions: number;
    participants: number;
    quizAttempts: number;
    correctPct: number | null;
    lastRunAt: string | null;
  }[];
  difficulty: {
    slideId: string;
    deckTitle: string;
    question: string;
    attempts: number;
    correctPct: number;
    avgMs: number | null;
  }[];
  learners: {
    nickname: string;
    sessions: number;
    quizAttempts: number;
    correctPct: number | null;
    lastSeenAt: string;
    progress: { at: string; pct: number }[];
  }[];
}

type FetchState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; data: Analytics };

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-dim">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-dim">{hint}</p>}
    </Card>
  );
}

/** Weekly engagement columns. Height encodes participants; the count is also
 *  printed above each column so the chart is never color/size-only. */
function TrendChart({ trend }: { trend: Analytics['trend'] }) {
  const max = Math.max(1, ...trend.map((t) => t.participants));
  const label = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  return (
    <div role="img" aria-label={`Participants per week over the last 12 weeks: ${trend.map((t) => `${label(t.weekStart)}: ${t.participants} participants in ${t.sessions} sessions`).join('; ')}`}>
      <div className="flex h-40 items-end gap-1.5" aria-hidden="true">
        {trend.map((t) => (
          <div key={t.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-fg-dim">
              {t.participants > 0 ? t.participants : ''}
            </span>
            <div
              className="w-full rounded-t-md transition-[height] duration-300"
              style={{
                height: `${t.participants > 0 ? Math.max(4, (t.participants / max) * 100) : 2}%`,
                background: t.participants > 0 ? 'var(--chart-1)' : 'var(--color-edge)',
                opacity: t.participants > 0 ? 0.85 : 0.6,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
        {trend.map((t, i) => (
          <span key={t.weekStart} className="flex-1 text-center text-[10px] tabular-nums text-fg-dim">
            {i % 2 === 0 ? label(t.weekStart) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Thin horizontal meter with the % always printed next to it. */
function PctBar({ pct }: { pct: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct < 40 ? 'var(--color-red)' : pct < 70 ? 'var(--chart-3)' : 'var(--color-emerald)',
          }}
        />
      </span>
      <span className="tabular-nums font-semibold text-fg">{pct}%</span>
    </span>
  );
}

/** Tiny inline sparkline of a learner's per-session quiz accuracy. */
function Spark({ points }: { points: { at: string; pct: number }[] }) {
  if (points.length < 2) return <span className="text-xs text-fg-dim">—</span>;
  const w = 72;
  const h = 20;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 4) + 2);
  const ys = points.map((p) => h - 3 - (p.pct / 100) * (h - 6));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const first = points[0].pct;
  const last = points[points.length - 1].pct;
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Accuracy trend from ${first}% to ${last}% over ${points.length} sessions`}
        className="shrink-0"
      >
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill="var(--color-accent)" />
      </svg>
      <span className={`text-xs font-semibold tabular-nums ${last >= first ? 'text-emerald' : 'text-red'}`}>
        {last >= first ? '▲' : '▼'} {Math.abs(last - first)}
        <span className="sr-only"> points {last >= first ? 'improvement' : 'decline'}</span>
      </span>
    </span>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="px-6 py-5">
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {hint && <p className="mt-0.5 mb-4 text-sm text-fg-dim">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </Card>
  );
}

const th = 'px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-fg-dim';
const td = 'px-3 py-2.5 text-sm text-fg';

export function AnalyticsClient() {
  const [state, setState] = useState<FetchState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const res = await fetch('/api/account/analytics');
      if (!res.ok) throw new Error(String(res.status));
      setState({ phase: 'ready', data: (await res.json()) as Analytics });
    } catch {
      setState({ phase: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link href="/studio" className="text-sm font-semibold text-fg-dim transition-colors hover:text-fg">
            ← Studio
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-fg">Trainer analytics</h1>
          <p className="mt-1 text-sm text-fg-dim">
            Engagement, question difficulty and learner progress across every session you&apos;ve run.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
        </div>
      </header>

      {state.phase === 'loading' && (
        <div className="flex items-center justify-center gap-3 py-24 text-fg-dim" role="status" aria-live="polite">
          <Spinner /> Crunching your sessions…
        </div>
      )}

      {state.phase === 'error' && (
        <Card role="alert" className="px-8 py-12 text-center">
          <p className="font-semibold text-fg">Couldn&apos;t load your analytics.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-dim">
            Check your connection and try again — your session data is safe.
          </p>
          <Button className="mt-5" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </Card>
      )}

      {state.phase === 'ready' && state.data.totals.sessions === 0 && (
        <Card className="px-8 py-14 text-center">
          <p className="text-4xl" aria-hidden="true">📊</p>
          <h2 className="mt-4 text-2xl font-bold text-fg">No sessions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-dim">
            Run your first live session and this page fills up with engagement trends, question
            difficulty stats and returning-learner progress.
          </p>
          <Button className="mt-6" onClick={() => (window.location.href = '/studio')}>
            Go to your decks
          </Button>
        </Card>
      )}

      {state.phase === 'ready' && state.data.totals.sessions > 0 && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Sessions" value={state.data.totals.sessions.toLocaleString()} hint={state.data.totals.lastSessionAt ? `last ${relativeTime(state.data.totals.lastSessionAt)}` : undefined} />
            <StatTile label="Participants" value={state.data.totals.participants.toLocaleString()} />
            <StatTile label="Responses" value={state.data.totals.responses.toLocaleString()} />
            <StatTile label="Decks run" value={state.data.decks.length.toLocaleString()} />
            <StatTile label="Returning learners" value={state.data.totals.returningLearners.toLocaleString()} hint="joined 2+ sessions" />
          </div>

          <SectionCard title="Engagement" hint="Participants reached per week, last 12 weeks.">
            <TrendChart trend={state.data.trend} />
          </SectionCard>

          <SectionCard
            title="Hardest questions"
            hint="Quiz questions ranked by % answered correctly (min. 3 attempts). Low scores usually mean the question — or the teaching before it — needs another look."
          >
            {state.data.difficulty.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-dim">
                No quiz data yet — difficulty stats appear once quiz slides collect a few answers.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-edge">
                      <th scope="col" className={th}>Question</th>
                      <th scope="col" className={th}>Deck</th>
                      <th scope="col" className={`${th} text-right`}>Attempts</th>
                      <th scope="col" className={th}>Correct</th>
                      <th scope="col" className={`${th} text-right`}>Avg. time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.difficulty.map((q) => (
                      <tr key={q.slideId} className="border-b border-edge/60">
                        <td className={`${td} max-w-[280px]`}>
                          <span className="line-clamp-2">{q.question}</span>
                        </td>
                        <td className={`${td} text-fg-dim`}>{q.deckTitle}</td>
                        <td className={`${td} text-right tabular-nums`}>{q.attempts}</td>
                        <td className={td}><PctBar pct={q.correctPct} /></td>
                        <td className={`${td} text-right tabular-nums text-fg-dim`}>
                          {q.avgMs != null ? `${(q.avgMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Decks" hint="Every deck you've run live, most recent first.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-edge">
                    <th scope="col" className={th}>Deck</th>
                    <th scope="col" className={`${th} text-right`}>Sessions</th>
                    <th scope="col" className={`${th} text-right`}>Participants</th>
                    <th scope="col" className={th}>Quiz accuracy</th>
                    <th scope="col" className={`${th} text-right`}>Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.decks.map((d) => (
                    <tr key={d.id} className="border-b border-edge/60">
                      <td className={`${td} font-semibold`}>{d.title}</td>
                      <td className={`${td} text-right tabular-nums`}>{d.sessions}</td>
                      <td className={`${td} text-right tabular-nums`}>{d.participants}</td>
                      <td className={td}>
                        {d.correctPct != null ? <PctBar pct={d.correctPct} /> : <span className="text-fg-dim">no quizzes</span>}
                      </td>
                      <td className={`${td} text-right text-fg-dim`}>
                        {d.lastRunAt ? relativeTime(d.lastRunAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Returning learners"
            hint="Devices that joined two or more of your sessions (latest nickname shown). The trend compares quiz accuracy from their first to their most recent session."
          >
            {state.data.learners.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-dim">
                No repeat participants yet. Once the same people join more than one session, their
                progress shows up here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="border-b border-edge">
                      <th scope="col" className={th}>Learner</th>
                      <th scope="col" className={`${th} text-right`}>Sessions</th>
                      <th scope="col" className={th}>Overall accuracy</th>
                      <th scope="col" className={th}>Trend</th>
                      <th scope="col" className={`${th} text-right`}>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.learners.map((l, i) => (
                      <tr key={i} className="border-b border-edge/60">
                        <td className={`${td} font-semibold`}>
                          {l.nickname} {l.sessions >= 4 && <Pill tone="accent">regular</Pill>}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{l.sessions}</td>
                        <td className={td}>
                          {l.correctPct != null ? <PctBar pct={l.correctPct} /> : <span className="text-fg-dim">no quizzes</span>}
                        </td>
                        <td className={td}><Spark points={l.progress} /></td>
                        <td className={`${td} text-right text-fg-dim`}>{relativeTime(l.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <p className="text-center text-xs text-fg-dim">
            Learners are counted per device and stay pseudonymous — nicknames only, never contact details.
          </p>
        </div>
      )}
    </div>
  );
}
