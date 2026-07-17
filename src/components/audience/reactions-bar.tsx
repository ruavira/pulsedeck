'use client';
// Emoji reactions: fire-and-forget broadcasts, throttled to 1 per 800ms with a
// tiny CSS cooldown pop. No framer-motion — audience path stays light.

import { useEffect, useRef, useState } from 'react';

const REACTIONS: { emoji: string; name: string }[] = [
  { emoji: '👏', name: 'Clap' },
  { emoji: '❤️', name: 'Love' },
  { emoji: '😂', name: 'Laugh' },
  { emoji: '🤯', name: 'Mind blown' },
  { emoji: '👍', name: 'Thumbs up' },
];

const THROTTLE_MS = 800;

export function ReactionsBar({
  broadcast,
}: {
  broadcast: (event: string, payload: unknown) => void;
}) {
  const lastSent = useRef(0);
  const [popped, setPopped] = useState<number | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const react = (emoji: string, i: number) => {
    const now = Date.now();
    if (now - lastSent.current < THROTTLE_MS) return; // silent throttle
    lastSent.current = now;
    broadcast('react', { emoji }); // fire-and-forget
    setPopped(i);
    setCoolingDown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPopped(null);
      setCoolingDown(false);
    }, THROTTLE_MS);
  };

  return (
    <div
      role="group"
      aria-label="Send a reaction"
      className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-edge bg-panel/90 px-2 py-1.5 backdrop-blur shadow-pop"
    >
      {REACTIONS.map((r, i) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => react(r.emoji, i)}
          aria-label={`React: ${r.name}`}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform duration-150 active:scale-90 ${
            popped === i ? 'scale-125' : coolingDown ? 'opacity-60' : ''
          }`}
        >
          <span aria-hidden="true">{r.emoji}</span>
        </button>
      ))}
    </div>
  );
}
