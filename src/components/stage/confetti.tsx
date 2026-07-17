'use client';
// Dependency-free canvas confetti burst for the leaderboard's #1 moment.
// ~120 rects in the chart-palette colors fall from the top with rotation and
// horizontal drift, fading out at the end. Runs on requestAnimationFrame,
// cancels on unmount, and is skipped entirely under prefers-reduced-motion.
// Colors are resolved from the --chart-N CSS variables at mount so the burst
// always matches the active theme (canvas cannot consume var() directly).

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  sway: number;
  swayPhase: number;
}

export function ConfettiBurst({
  durationMs = 2500,
  count = 120,
}: {
  /** Total burst lifetime in ms (includes the fade-out tail). */
  durationMs?: number;
  /** Number of confetti rects. */
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve the theme chart palette; bail quietly if the tokens are absent.
    const styles = getComputedStyle(canvas);
    const palette: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const c = styles.getPropertyValue(`--chart-${i}`).trim();
      if (c) palette.push(c);
    }
    if (palette.length === 0) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: rand(-0.05, 1.05) * w,
      y: rand(-140, -10),
      vx: rand(-70, 70),
      vy: rand(120, 420),
      rot: rand(0, Math.PI * 2),
      vr: rand(-8, 8),
      w: rand(6, 14),
      h: rand(8, 18),
      color: palette[Math.floor(Math.random() * palette.length)],
      sway: rand(1.2, 3.2),
      swayPhase: rand(0, Math.PI * 2),
    }));

    const FADE_MS = 400;
    let raf = 0;
    let start = 0;
    let last = 0;

    const tick = (t: number) => {
      if (start === 0) {
        start = t;
        last = t;
      }
      const elapsed = t - start;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      ctx.clearRect(0, 0, w, h);
      if (elapsed >= durationMs) return; // finished — canvas left clear, no more frames

      const alpha =
        elapsed > durationMs - FADE_MS ? Math.max(0, (durationMs - elapsed) / FADE_MS) : 1;

      for (const p of particles) {
        p.vy += 460 * dt; // gravity
        p.x += (p.vx + Math.sin((elapsed / 1000) * p.sway + p.swayPhase) * 46) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y - p.h > h) continue; // off-screen
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
