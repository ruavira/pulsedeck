'use client';
// PowerPoint content add-in surface. Embedded inside a PowerPoint slide via
// public/addin/manifest.xml. One-time setup: paste a PulseDeck stage link;
// afterwards this pane renders the live stage (results, QR, leaderboard)
// directly inside the deck — driven from the phone remote.
//
// AppSource note: validators land here with no session, so the empty state
// must explain the product and offer a path to value (the studio + support)
// without requiring an account.
import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/shared/ui';

const STORE = 'pd_addin_stage_url';

function parseStageUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!/\/present\/[0-9a-f-]{36}/.test(u.pathname)) return null;
    return u.origin === window.location.origin ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function AddinPage() {
  const [stageUrl, setStageUrl] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setStageUrl(localStorage.getItem(STORE));
    } catch {
      setStageUrl(null); // storage blocked — still usable for this run
    }
  }, []);

  if (stageUrl === undefined) return null;

  if (!stageUrl) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink p-6 text-center">
        <h1 className="text-xl font-extrabold text-fg">PulseDeck Live</h1>
        <p className="max-w-md text-sm leading-relaxed text-fg-dim">
          Show your live PulseDeck stage — polls, word clouds, quizzes, Q&amp;A and the
          leaderboard — right inside this slide. Paste your session&apos;s{' '}
          <strong className="text-fg">stage link</strong> from the Present dialog to connect.
        </p>
        <div className="w-full max-w-md">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') document.getElementById('pd-addin-go')?.click();
            }}
            placeholder="https://pulsedeck-live.netlify.app/present/…?key=…"
            aria-label="Stage link"
          />
        </div>
        {error && (
          <p role="alert" className="max-w-md text-sm text-red">
            {error}
          </p>
        )}
        <Button
          id="pd-addin-go"
          onClick={() => {
            const parsed = parseStageUrl(draft);
            if (!parsed) {
              setError(
                'That doesn’t look like a PulseDeck stage link. It should start with "https://pulsedeck-live.netlify.app/present/" — copy it from the Present dialog in the studio.',
              );
              return;
            }
            try {
              localStorage.setItem(STORE, parsed);
            } catch {
              /* storage blocked — session-only */
            }
            setStageUrl(parsed);
          }}
        >
          Show live stage
        </Button>
        <p className="max-w-md text-xs leading-relaxed text-fg-dim">
          New to PulseDeck? It&apos;s free and needs no account — build a deck at{' '}
          <a
            href="https://pulsedeck-live.netlify.app/studio"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            pulsedeck-live.netlify.app/studio
          </a>
          , press <strong className="text-fg">Present</strong>, and paste the stage link here.{' '}
          <a
            href="https://pulsedeck-live.netlify.app/support"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Help &amp; support
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full bg-ink">
      <iframe
        src={stageUrl}
        title="PulseDeck live stage"
        className="h-full w-full border-0"
        allow="fullscreen"
      />
      <button
        onClick={() => {
          try {
            localStorage.removeItem(STORE);
          } catch {
            /* ignore */
          }
          setStageUrl(null);
          setDraft('');
        }}
        className="absolute right-2 top-2 rounded-full border border-edge bg-panel/90 px-3 py-1 text-xs font-semibold text-fg-dim hover:text-fg"
      >
        Change session
      </button>
    </div>
  );
}
