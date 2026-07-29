'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Pill } from '@/components/shared/ui';

interface PairingResult {
  code: string;
  expiresAt: string;
}

function countdownLabel(seconds: number): string {
  if (seconds >= 86_400) {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    return `${days}d ${hours}h`;
  }
  if (seconds >= 3_600) {
    const hours = Math.floor(seconds / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function GammaSyncCard({
  busy,
  createPairingCode,
}: {
  busy: string | null;
  createPairingCode: () => Promise<PairingResult | null>;
}) {
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pairing) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((Date.parse(pairing.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-fg">Gamma Sync</p>
        <Pill tone="accent">Secure pairing</Pill>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-fg-dim">
        Pair Chrome with a 72-hour, one-use code. Creating a new code invalidates the previous unused code.
        Your full presenter key never enters the extension.
      </p>
      {pairing && seconds > 0 ? (
        <div className="mt-3 rounded-2xl border border-cyan/35 bg-cyan/10 p-4 text-center">
          <p className="font-mono text-2xl font-black tracking-[0.16em] text-fg" aria-label={`Pairing code ${pairing.code}`}>
            {pairing.code}
          </p>
          <p className="mt-1 text-xs text-fg-dim">Expires in {countdownLabel(seconds)} · one use only</p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(pairing.code);
              setCopied(true);
            }}
          >
            {copied ? 'Code copied' : 'Copy pairing code'}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          className="mt-3 min-h-[56px] w-full"
          disabled={busy !== null}
          onClick={async () => {
            setFailed(false);
            setCopied(false);
            const result = await createPairingCode();
            if (result) setPairing(result);
            else setFailed(true);
          }}
        >
          {busy === 'gamma-pair' ? 'Creating secure code…' : 'Create Gamma pairing code'}
        </Button>
      )}
      {failed && <p className="mt-2 text-sm text-red" role="alert">Couldn&apos;t create a code. Check your connection and retry.</p>}
    </Card>
  );
}
