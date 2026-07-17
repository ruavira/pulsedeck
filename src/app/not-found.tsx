// Global 404. Dark, friendly, and always offers a way out.

import Link from 'next/link';
import { LogoMark, StageBars } from '@/components/landing/decor';

export default function NotFound() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-ink px-5 py-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-160px] h-[480px] w-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 72%)',
        }}
      />

      <LogoMark size={44} gradientId="pd-mark-404" />

      <p className="mt-8 font-mono text-sm font-semibold uppercase tracking-[0.3em] text-cyan">
        404
      </p>
      <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-fg sm:text-4xl">
        This slide doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-balance text-fg-dim">
        The page you&apos;re after may have moved, or the link had a typo. If you&apos;re trying to
        join a presentation, head back and enter the 6-letter code from the big screen.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-accent-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
        >
          Back to the start
        </Link>
        <Link
          href="/studio"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-edge bg-panel-2 px-6 py-3 font-semibold text-fg transition-colors duration-150 hover:border-accent/60"
        >
          Open the studio
        </Link>
      </div>

      <StageBars className="mt-16 h-20 w-full max-w-sm opacity-60" />
    </div>
  );
}
