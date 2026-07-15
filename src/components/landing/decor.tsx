// Server-rendered decoration for the landing page. Pure CSS/SVG — no client
// JS, no images, no motion libraries. Colors come from the design tokens.

/** Inline PulseDeck mark: rounded square + violet→cyan pulse "P".
 *  Pass a unique `gradientId` when rendering the mark more than once per page. */
export function LogoMark({
  size = 28,
  gradientId = 'pd-mark',
}: {
  size?: number;
  gradientId?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-cyan)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="var(--color-panel)" />
      <rect
        width="31"
        height="31"
        x="0.5"
        y="0.5"
        rx="6.5"
        fill="none"
        stroke="var(--color-edge)"
      />
      <path
        d="M11 25 V8 h5.4 a5.5 5.5 0 0 1 0 11 H11"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 24.5 h2 l1.4 -3.2 1.7 4.7 1.4 -3 h2.5"
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wordmark + mark, used in the header and footer. */
export function Wordmark({ gradientId = 'pd-mark' }: { gradientId?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark gradientId={gradientId} />
      <span className="text-lg font-bold tracking-tight text-fg">
        Pulse<span className="text-accent">Deck</span>
      </span>
    </span>
  );
}

const BAR_HEIGHTS = [34, 58, 42, 88, 66, 100, 52, 76, 38, 62, 84, 46];

/**
 * Stylized stage-bars motif: a skyline of live-poll bars, drawn with divs.
 * Decorative only.
 */
export function StageBars({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-end justify-center gap-1.5 sm:gap-2 ${className}`}
    >
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-2.5 rounded-t-full sm:w-3.5"
          style={{
            height: `${h}%`,
            opacity: 0.25 + (h / 100) * 0.55,
            background:
              'linear-gradient(to top, color-mix(in srgb, var(--color-accent) 80%, transparent), color-mix(in srgb, var(--color-cyan) 85%, transparent))',
          }}
        />
      ))}
    </div>
  );
}

/** Soft radial accent glow, absolutely positioned by the caller. */
export function Glow({
  color = 'accent',
  className = '',
}: {
  color?: 'accent' | 'cyan';
  className?: string;
}) {
  const token = color === 'cyan' ? '--color-cyan' : '--color-accent';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{
        background: `radial-gradient(closest-side, color-mix(in srgb, var(${token}) 18%, transparent), transparent 72%)`,
      }}
    />
  );
}
