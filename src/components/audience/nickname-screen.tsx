'use client';
// First-join nickname screen: pick a name (or get a fun random one) and join.

import { useState } from 'react';
import { Button, Input } from '@/components/shared/ui';
import { PrivacyBadge } from './bits';

const ADJECTIVES = [
  'Brave', 'Cosmic', 'Swift', 'Mellow', 'Bold', 'Lucky', 'Nimble', 'Sunny',
  'Clever', 'Dazzling', 'Electric', 'Gentle', 'Mighty', 'Quiet', 'Radiant',
  'Turbo', 'Velvet', 'Witty', 'Zesty', 'Golden',
];
const ANIMALS = [
  'Falcon', 'Otter', 'Panda', 'Lynx', 'Dolphin', 'Fox', 'Heron', 'Ibex',
  'Jaguar', 'Koala', 'Lemur', 'Marmot', 'Narwhal', 'Owl', 'Puffin',
  'Quokka', 'Raven', 'Tiger', 'Walrus', 'Yak',
];

export function suggestNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a} ${b}`;
}

export function NicknameScreen({
  code,
  joining,
  inlineError,
  onJoin,
}: {
  code: string;
  joining: boolean;
  inlineError?: string | null;
  onJoin: (nickname: string) => void;
}) {
  const [nick, setNick] = useState('');
  const trimmed = nick.trim();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <form
        className="w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && !joining) onJoin(trimmed);
        }}
      >
        <p className="text-center text-sm font-bold tracking-widest text-accent uppercase mb-2">
          PulseDeck
        </p>
        <h1 className="text-center text-2xl font-bold text-fg mb-1.5">You&apos;re almost in</h1>
        <p className="text-center text-sm text-fg-dim mb-7">
          Joining session{' '}
          <span className="font-mono font-bold tracking-widest text-cyan">{code}</span>
        </p>

        <label htmlFor="nickname" className="mb-2 block text-sm font-semibold text-fg">
          Pick a nickname
        </label>
        <Input
          id="nickname"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={40}
          placeholder="e.g. Brave Falcon"
          autoComplete="off"
          autoFocus
          disabled={joining}
        />

        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={joining}
            onClick={() => setNick(suggestNickname())}
          >
            🎲 Surprise me
          </Button>
        </div>

        {inlineError && (
          <p role="alert" className="mt-3 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-fg">
            {inlineError}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={!trimmed || joining}>
          {joining ? 'Joining…' : 'Join'}
        </Button>

        <div className="mt-6 flex justify-center">
          <PrivacyBadge />
        </div>
        <p className="mt-2 text-center text-xs text-fg-dim">
          No account needed — your answers stay anonymous to the room.
        </p>
      </form>
    </main>
  );
}
