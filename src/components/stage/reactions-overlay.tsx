'use client';
// Floating emoji reactions (audience -> stage via `react` broadcasts).
// Pure CSS animation (no framer-motion needed for this volume), capped at 30
// concurrent, skipped entirely when the presenter prefers reduced motion.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface ReactionsHandle {
  push: (emoji: string) => void;
}

interface FloatingEmoji {
  id: number;
  emoji: string;
  left: number; // % within the overlay strip
  drift: number; // px horizontal drift
  size: number; // px
  duration: number; // ms
}

const MAX_CONCURRENT = 30;

export const ReactionsOverlay = forwardRef<ReactionsHandle>(function ReactionsOverlay(_props, ref) {
  const [items, setItems] = useState<FloatingEmoji[]>([]);
  const nextId = useRef(1);
  const reduced = useRef(false);
  const timeouts = useRef<Set<number>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    const pending = timeouts.current;
    return () => {
      mq.removeEventListener('change', onChange);
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      push(emoji: string) {
        if (reduced.current) return; // reduced motion: skip the flourish entirely
        const clean = typeof emoji === 'string' ? emoji.slice(0, 8).trim() : '';
        if (!clean) return;
        const id = nextId.current++;
        const duration = 2400 + Math.random() * 900;
        setItems((cur) => {
          if (cur.length >= MAX_CONCURRENT) return cur;
          return [
            ...cur,
            {
              id,
              emoji: clean,
              left: 10 + Math.random() * 80,
              drift: (Math.random() - 0.5) * 90,
              size: 28 + Math.random() * 18,
              duration,
            },
          ];
        });
        const t = window.setTimeout(() => {
          setItems((c) => c.filter((x) => x.id !== id));
          timeouts.current.delete(t);
        }, duration + 100);
        timeouts.current.add(t);
      },
    }),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-6 right-6 z-30 h-[70vh] w-44 overflow-hidden"
    >
      <style>{`@keyframes pd-react-float {
        0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
        12% { opacity: 1; transform: translate(calc(var(--dx) * 0.15), -8vh) scale(1); }
        100% { opacity: 0; transform: translate(var(--dx), -62vh) scale(1.15); }
      }`}</style>
      {items.map((it) => (
        <span
          key={it.id}
          className="absolute bottom-0 leading-none will-change-transform"
          style={
            {
              left: `${it.left}%`,
              fontSize: `${it.size}px`,
              '--dx': `${it.drift}px`,
              animation: `pd-react-float ${it.duration}ms ease-out forwards`,
            } as React.CSSProperties
          }
        >
          {it.emoji}
        </span>
      ))}
    </div>
  );
});
