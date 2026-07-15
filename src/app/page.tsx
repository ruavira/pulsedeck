// Landing page. Server-rendered and static except the join-code form island.
// Priority one: an audience member is voting within 10 seconds of landing here.

import Link from 'next/link';
import { JoinCodeForm } from '@/components/landing/join-code-form';
import { InstallAppButton } from '@/components/shared/pwa';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { Glow, StageBars, Wordmark } from '@/components/landing/decor';
import {
  IconBars,
  IconCrowd,
  IconQa,
  IconQr,
  IconSlides,
  IconSparkles,
  IconSwap,
  IconTrophy,
} from '@/components/landing/feature-icons';

// Link styled exactly like the shared Button variants (Button renders a
// <button>; navigation needs an <a>, so we mirror its classes 1:1).
const linkBtnBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150';
const linkBtnPrimary = `${linkBtnBase} px-7 py-3.5 text-lg min-h-[52px] bg-accent text-white hover:brightness-110 active:scale-[0.98] shadow-accent-glow`;
const linkBtnSecondary = `${linkBtnBase} px-5 py-2.5 text-[15px] min-h-[44px] bg-panel-2 text-fg border border-edge hover:border-accent/60`;

const FEATURES: {
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  title: string;
  blurb: string;
}[] = [
  {
    icon: IconBars,
    tint: 'text-accent',
    title: 'Live polls & word clouds',
    blurb: 'Ask the room anything and watch answers land on the big screen in real time.',
  },
  {
    icon: IconTrophy,
    tint: 'text-amber',
    title: 'Kahoot-grade quizzes',
    blurb: 'Speed points, streaks and a podium — scored on the server, so nobody can cheat the clock.',
  },
  {
    icon: IconQa,
    tint: 'text-cyan',
    title: 'Q&A with upvoting',
    blurb: 'The audience asks, the room upvotes, you answer what matters. Moderation optional.',
  },
  {
    icon: IconSlides,
    tint: 'text-rose',
    title: 'Real slides with video',
    blurb: 'Headings, images, quotes, big stats, YouTube and MP4 — a proper deck, not a toy.',
  },
  {
    icon: IconSparkles,
    tint: 'text-accent',
    title: 'AI deck generation',
    blurb: 'Draft a full deck or quiz from a topic in seconds. Entirely optional — everything works without it.',
  },
  {
    icon: IconSwap,
    tint: 'text-emerald',
    title: 'Import and export everything',
    blurb: 'Bring PPTX, PDF or Markdown in. Take slides, results and spreadsheets out. No lock-in.',
  },
  {
    icon: IconQr,
    tint: 'text-cyan',
    title: 'One QR. No apps, no accounts',
    blurb: 'Your audience scans and votes in the browser. Nothing to install, nothing to sign up for.',
  },
  {
    icon: IconCrowd,
    tint: 'text-emerald',
    title: 'Built to survive 1,000 phones',
    blurb: 'One realtime channel per room, tiny payloads and graceful reconnects. Keynote-day tested.',
  },
];

const STEPS: { step: string; title: string; blurb: string }[] = [
  {
    step: '1',
    title: 'Create',
    blurb: 'Build slides and activities in the studio — or import a deck you already have.',
  },
  {
    step: '2',
    title: 'Share the QR',
    blurb: 'Go live and put the QR code and 6-letter code up on the big screen.',
  },
  {
    step: '3',
    title: 'Present',
    blurb: 'Drive everything from your phone. Results land live; export it all when you are done.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip bg-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-panel focus:px-4 focus:py-2 focus:text-fg"
      >
        Skip to content
      </a>

      {/* ---------- Header ---------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="rounded-full py-1 pr-2"
          aria-label="PulseDeck home"
        >
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitcher className="hidden sm:block" />
          <InstallAppButton className="hidden sm:inline-flex" />
          <Link
            href="/pricing"
            className="hidden text-sm font-semibold text-fg-dim transition-colors hover:text-fg sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-fg-dim transition-colors hover:text-fg"
          >
            Sign in
          </Link>
          <Link href="/signup" className={linkBtnSecondary}>
            Start free
          </Link>
        </div>
      </header>

      {/* ---------- Hero: audience join first ---------- */}
      <main id="main" className="relative flex flex-1 flex-col">
        <section className="relative flex min-h-[70dvh] flex-col items-center justify-center px-5 pb-16 pt-10 sm:pt-16">
          <Glow className="left-1/2 top-[-180px] h-[520px] w-[720px] -translate-x-1/2" />
          <Glow color="cyan" className="right-[-160px] top-[40%] h-[380px] w-[380px]" />

          <h1 className="text-balance text-center text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Joining a presentation?
          </h1>
          <p className="mt-3 max-w-md text-center text-fg-dim">
            Type the code and you are in — no app, no account, no name required.
          </p>

          <div className="relative mt-8 flex w-full justify-center">
            <JoinCodeForm />
          </div>

          {/* Presenter CTA — secondary but unmissable */}
          <div className="relative mt-12 flex w-full max-w-md items-center gap-4" aria-hidden="true">
            <div className="h-px flex-1 bg-edge" />
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-fg-dim">
              or
            </span>
            <div className="h-px flex-1 bg-edge" />
          </div>

          <div className="relative mt-8 flex flex-col items-center gap-4 text-center">
            <p className="max-w-sm text-fg-dim">
              <span className="font-semibold text-fg">Presenting today?</span>{' '}Build a deck with
              live polls, quizzes and Q&amp;A — your audience joins in seconds.
            </p>
            <Link href="/studio" className={linkBtnPrimary}>
              Open the studio
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* Stage-bars motif bridging hero and story */}
        <div className="relative mx-auto h-28 w-full max-w-3xl px-8 sm:h-36">
          <StageBars className="h-full" />
          <div
            aria-hidden="true"
            className="absolute inset-x-8 bottom-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, color-mix(in srgb, var(--color-accent) 55%, transparent), color-mix(in srgb, var(--color-cyan) 55%, transparent), transparent)',
            }}
          />
        </div>

        {/* ---------- Product story ---------- */}
        <section className="relative mx-auto w-full max-w-6xl px-5 pb-8 pt-20 sm:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-cyan">
            PulseDeck
          </p>
          <h2 className="mt-3 text-balance text-center text-3xl font-bold tracking-tight text-fg sm:text-5xl">
            Presentations with a pulse
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-lg text-fg-dim">
            Slides, polls, quizzes and Q&amp;A in one deck. Your audience joins from their phones
            with one QR code, and every answer lights up the big screen live.
          </p>
        </section>

        {/* ---------- Feature grid ---------- */}
        <section
          aria-label="What PulseDeck does"
          className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8"
        >
          <Glow className="left-[-200px] top-[10%] h-[420px] w-[420px]" />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="group rounded-2xl border border-edge bg-panel p-5 transition-colors duration-200 hover:border-accent/50"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-panel-2 ${f.tint}`}
                >
                  <f.icon />
                </span>
                <h3 className="mt-4 text-base font-semibold text-fg">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">{f.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- How it works ---------- */}
        <section
          aria-label="How it works"
          className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8"
        >
          <h2 className="text-center text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.step} className="relative flex flex-col items-center text-center">
                {/* connector line between steps (decorative, desktop only) */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="absolute left-[calc(50%+40px)] top-7 hidden h-px w-[calc(100%-80px)] sm:block"
                    style={{
                      background:
                        'linear-gradient(to right, color-mix(in srgb, var(--color-accent) 50%, transparent), color-mix(in srgb, var(--color-cyan) 40%, transparent))',
                    }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent-soft font-mono text-xl font-bold text-accent"
                >
                  {s.step}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-fg">{s.title}</h3>
                <p className="mt-1.5 max-w-[28ch] text-sm leading-relaxed text-fg-dim">{s.blurb}</p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex justify-center">
            <Link href="/studio" className={linkBtnPrimary}>
              Start building — it&apos;s free
            </Link>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="relative border-t border-edge">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-10 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Wordmark gradientId="pd-mark-footer" />
            <p className="text-center text-sm text-fg-dim sm:text-left">
              No accounts. No participant tracking. Your data exports freely.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-2">
            {[
              { href: '/j', label: 'Join with a code' },
              { href: '/studio', label: 'Studio' },
              { href: '/support', label: 'Support' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-fg-dim transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
