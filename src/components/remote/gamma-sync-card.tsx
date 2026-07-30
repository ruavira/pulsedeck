'use client';

import { useState } from 'react';
import { Button, Card, Pill } from '@/components/shared/ui';

interface PairingResult {
  code: string;
  expiresAt: string | null;
  neverExpires?: boolean;
  trustedDevice?: boolean;
}

export function GammaSyncCard({
  busy,
  createPairingCode,
}: {
  busy: string | null;
  createPairingCode: () => Promise<PairingResult | null>;
}) {
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-fg">Gamma Sync</p>
        <Pill tone="accent">Trusted presenter</Pill>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-fg-dim">
        Create a one-use pairing code that does not expire. After redemption, this Chrome receives a revocable,
        session-scoped controller token and becomes a trusted presenter device. Your full presenter key never enters
        the extension.
      </p>
      {pairing ? (
        <div className="mt-3 rounded-2xl border border-cyan/35 bg-cyan/10 p-4 text-center">
          <p className="font-mono text-2xl font-black tracking-[0.16em] text-fg" aria-label={`Pairing code ${pairing.code}`}>
            {pairing.code}
          </p>
          <p className="mt-1 text-xs text-fg-dim">Never expires · one use only · revocable after pairing</p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(pairing.code);
              setCopied(true);
            }}
          >
            {copied ? 'Code copied' : 'Copy trusted-device code'}
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
          {busy === 'gamma-pair' ? 'Creating trusted-device code…' : 'Create trusted presenter code'}
        </Button>
      )}
      {failed && <p className="mt-2 text-sm text-red" role="alert">Couldn&apos;t create a code. Check your connection and retry.</p>}
    </Card>
  );
}
