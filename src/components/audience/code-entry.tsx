'use client';
// Manual join-code entry: six giant boxes, auto-advance, auto-submit on the 6th
// character. Paste-friendly. Redirects to /j/{code}.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/shared/ui';

const LEN = 6;
const STRIP = /[^A-Z0-9]/g;

export function CodeEntry({ badCode }: { badCode?: string }) {
  const router = useRouter();
  const [chars, setChars] = useState<string[]>(() => Array<string>(LEN).fill(''));
  const [navigating, setNavigating] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const go = useCallback(
    (code: string) => {
      setNavigating(true);
      router.push(`/j/${code}`);
    },
    [router],
  );

  const commit = useCallback(
    (next: string[]) => {
      setChars(next);
      if (next.every((c) => c !== '')) go(next.join(''));
    },
    [go],
  );

  const fillFrom = useCallback(
    (start: number, text: string) => {
      const clean = text.toUpperCase().replace(STRIP, '');
      if (!clean) return;
      const next = [...chars];
      let i = start;
      for (const ch of clean) {
        if (i >= LEN) break;
        next[i] = ch;
        i += 1;
      }
      commit(next);
      const focusAt = Math.min(i, LEN - 1);
      inputs.current[focusAt]?.focus();
    },
    [chars, commit],
  );

  const onChange = (i: number, value: string) => {
    const clean = value.toUpperCase().replace(STRIP, '');
    if (!clean) {
      const next = [...chars];
      next[i] = '';
      setChars(next);
      return;
    }
    fillFrom(i, clean);
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (next[i]) {
        next[i] = '';
        setChars(next);
      } else if (i > 0) {
        next[i - 1] = '';
        setChars(next);
        inputs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    } else if (e.key === 'Enter' && chars.every((c) => c !== '')) {
      go(chars.join(''));
    }
  };

  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(i, e.clipboardData.getData('text'));
  };

  const full = chars.every((c) => c !== '');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-bold tracking-widest text-accent uppercase mb-2">PulseDeck</p>
        <h1 className="text-2xl font-bold text-fg mb-1.5">Join a session</h1>
        <p className="text-sm text-fg-dim mb-7">Enter the 6-character code on the big screen.</p>

        {badCode && (
          <Card role="alert" className="mb-6 px-4 py-3 border-amber/40 bg-amber/10 text-left">
            <p className="text-sm text-fg">
              <span className="font-mono font-bold tracking-widest">{badCode}</span> didn&apos;t
              match a live session. Double-check the code and try again.
            </p>
          </Card>
        )}

        <fieldset
          className="flex justify-center gap-2 mb-7"
          aria-label="Join code, 6 characters"
          disabled={navigating}
        >
          {chars.map((ch, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={ch}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.target.select()}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              spellCheck={false}
              maxLength={LEN}
              aria-label={`Character ${i + 1} of ${LEN}`}
              autoFocus={i === 0}
              className="h-16 w-12 rounded-xl border border-edge bg-panel-2 text-center font-mono text-3xl font-bold uppercase text-fg caret-accent focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            />
          ))}
        </fieldset>

        <Button
          size="lg"
          className="w-full"
          disabled={!full || navigating}
          onClick={() => go(chars.join(''))}
        >
          {navigating ? 'Taking you in…' : 'Join'}
        </Button>

        <p className="mt-5 text-xs text-fg-dim">
          No app, no account — only your nickname is ever visible.
        </p>
      </div>
    </main>
  );
}
