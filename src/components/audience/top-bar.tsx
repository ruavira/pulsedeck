'use client';
// Slim persistent audience chrome: deck title, join code, avatar + nickname,
// quiz score pill, and a connection dot (never color-only — has an accessible
// label + the reconnecting toast carries the text).

import { JoinCode } from '@/components/shared/ui';
import { avatarFor } from './bits';
import { useAudiencePrefs } from './prefs';

export function TopBar({
  deckTitle,
  code,
  nickname,
  participantId,
  connected,
  score,
  streak,
  showScore,
}: {
  deckTitle: string;
  code: string;
  nickname: string;
  participantId: string;
  connected: boolean;
  score: number;
  streak: number;
  showScore: boolean;
}) {
  const prefs = useAudiencePrefs();
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-md items-center gap-2.5 px-3">
        <span
          role="status"
          aria-label={connected ? 'Connected' : 'Reconnecting'}
          title={connected ? 'Connected' : 'Reconnecting'}
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            connected ? 'bg-emerald' : 'bg-amber animate-pulse'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg leading-tight">{deckTitle}</p>
          <p className="truncate text-[11px] text-fg-dim leading-tight">
            <span aria-hidden="true" className="mr-1">
              {avatarFor(participantId)}
            </span>
            {nickname}
          </p>
        </div>
        {showScore && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-bold text-fg">
            <span aria-hidden="true">★</span>
            <span aria-label={`Score ${score} points`}>{score.toLocaleString()}</span>
            {streak > 1 && (
              <span className="text-fg" aria-label={`${streak} answer streak`}>
                🔥{streak}
              </span>
            )}
          </span>
        )}
        <JoinCode code={code} className="shrink-0 text-xs" />
        <button
          type="button"
          onClick={prefs.open}
          aria-label={prefs.t('a11y')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-panel text-sm font-bold text-fg-dim hover:text-fg"
        >
          <span aria-hidden="true">A</span>
          <span aria-hidden="true" className="text-[10px]">a</span>
        </button>
      </div>
    </header>
  );
}
