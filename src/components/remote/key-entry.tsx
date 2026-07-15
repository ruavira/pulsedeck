'use client';
// No presenter key on this device — paste screen. The key is shown in the
// studio at go-live and encoded in the remote QR/link on the stage screen.

import { useState } from 'react';
import { Button, Card, Input } from '@/components/shared/ui';

export function KeyEntry({
  error,
  busy,
  onSubmit,
}: {
  error: string | null;
  busy: boolean;
  onSubmit: (key: string) => void;
}) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();

  return (
    <div className="min-h-dvh bg-ink flex items-center justify-center px-5">
      <Card className="w-full max-w-md p-6 flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            PulseDeck
          </p>
          <h1 className="mt-1 text-2xl font-bold text-fg">Presenter remote</h1>
          <p className="mt-2 text-sm text-fg-dim leading-relaxed">
            This phone isn&apos;t paired yet. Paste your presenter key — it&apos;s shown in
            the studio when you go live, or scan the remote QR on the stage screen to
            skip this step.
          </p>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !busy) onSubmit(trimmed);
          }}
        >
          <label htmlFor="presenter-key" className="text-sm font-semibold text-fg">
            Presenter key
          </label>
          <Input
            id="presenter-key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste key…"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'key-error' : undefined}
          />
          {error && (
            <p id="key-error" role="alert" className="text-sm text-red">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={!trimmed || busy} className="w-full">
            {busy ? 'Checking…' : 'Unlock remote'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
