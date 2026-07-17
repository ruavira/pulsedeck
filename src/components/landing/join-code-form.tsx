'use client';

// Landing-page join form: 6-character code, giant boxes, auto-advance,
// auto-submit -> /j/{code}. Deliberately light: no framer-motion, CSS only.

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/ui';

const CODE_LENGTH = 6;

/** Uppercase, strip anything that can never appear in a join code. */
function sanitize(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export function JoinCodeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (value: string) => {
      if (submittedRef.current) return;
      if (value.length !== CODE_LENGTH) {
        setError(`Enter all ${CODE_LENGTH} characters of the code on screen.`);
        return;
      }
      submittedRef.current = true;
      setError(null);
      setJoining(true);
      router.push(`/j/${value}`);
    },
    [router],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittedRef.current) return;
    const next = sanitize(e.target.value);
    setCode(next);
    if (error) setError(null);
    if (next.length === CODE_LENGTH) submit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(code);
    }
  };

  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(code);
      }}
      className="w-full max-w-md"
      aria-label="Join a presentation by code"
    >
      <label
        htmlFor="join-code"
        className="mb-3 block text-center text-sm font-semibold uppercase tracking-[0.2em] text-fg-dim"
      >
        Enter the code on screen
      </label>

      {/* One real input laid invisibly over the boxes: native paste, native
          mobile keyboard, no per-box focus juggling. */}
      <div className="relative">
        <div
          className="flex justify-center gap-2 sm:gap-3"
          aria-hidden="true"
        >
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const filled = i < code.length;
            const active = focused && !joining && i === activeIndex && code.length < CODE_LENGTH;
            return (
              <div
                key={i}
                className={`flex h-16 w-11 items-center justify-center rounded-xl border-2 bg-panel font-mono text-3xl font-bold transition-colors duration-150 sm:h-[72px] sm:w-[52px] sm:text-4xl ${
                  active
                    ? 'border-accent ring-accent-soft'
                    : filled
                      ? 'border-edge text-fg'
                      : 'border-edge text-fg-dim'
                }`}
              >
                {code[i] ?? (
                  <span
                    className={`h-8 w-0.5 rounded bg-cyan ${active ? 'animate-pulse' : 'opacity-0'}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={inputRef}
          id="join-code"
          name="code"
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={joining}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
          style={{ fontSize: 16 }} // >=16px so iOS never zoom-jumps the hero
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={CODE_LENGTH}
          aria-describedby={error ? 'join-code-error' : 'join-code-hint'}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div aria-live="polite" className="mt-4 min-h-[24px] text-center text-sm">
        {joining ? (
          <span className="inline-flex items-center gap-2 font-semibold text-cyan">
            <Spinner className="h-4 w-4" />
            Taking you in…
          </span>
        ) : error ? (
          <span id="join-code-error" className="font-medium text-amber">
            <span aria-hidden="true">▲ </span>
            {error}
          </span>
        ) : (
          <span id="join-code-hint" className="text-fg-dim">
            Find the 6-letter code next to the QR on the big screen.
          </span>
        )}
      </div>
    </form>
  );
}
