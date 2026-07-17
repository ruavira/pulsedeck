'use client';
// Leaderboard table for the post-session report (top 25, print-friendly).

import { Card } from '@/components/shared/ui';
import type { LeaderboardEntry } from '@/lib/types';

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-6 print:border-neutral-300 print:bg-white">
        <p className="text-sm text-fg-dim print:text-neutral-600">
          No participants scored points in this session.
        </p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden print:border-neutral-300 print:bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Leaderboard — top {entries.length} participants by score</caption>
        <thead>
          <tr className="border-b border-edge text-xs uppercase tracking-wide text-fg-dim print:border-neutral-300 print:text-neutral-600">
            <th scope="col" className="px-5 py-3 font-semibold">
              Rank
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Nickname
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Score
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Best streak
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((p, i) => (
            <tr
              key={`${p.nickname}-${i}`}
              className="border-b border-edge/60 last:border-b-0 print:border-neutral-200"
            >
              <td className="px-5 py-2.5 tabular-nums text-fg-dim print:text-neutral-600">
                <span className="sr-only">Rank </span>
                {i + 1}
                {i < 3 && <span aria-hidden="true"> {['🥇', '🥈', '🥉'][i]}</span>}
              </td>
              <td className="px-5 py-2.5 font-medium text-fg print:text-black">
                {p.nickname || 'Anonymous'}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-fg print:text-black">
                {p.score.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-fg-dim print:text-neutral-600">
                {p.streak}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
