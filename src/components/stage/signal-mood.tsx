'use client';
// Host-only live "room mood" — aggregates the anonymous pace/comprehension
// signals participants tap on their phones (last ~30s) plus current raised hands.
// Ephemeral: no names, no storage, just a pulse of how the room feels.

const PACE: { kind: string; emoji: string; label: string }[] = [
  { kind: 'got_it', emoji: '👍', label: 'Got it' },
  { kind: 'slow', emoji: '🐢', label: 'Slow down' },
  { kind: 'lost', emoji: '🤔', label: 'Lost' },
  { kind: 'fast', emoji: '⚡', label: 'Speed up' },
];

export function SignalMood({
  counts,
  hands,
  onDismiss,
}: {
  counts: Record<string, number>;
  hands: number;
  onDismiss: () => void;
}) {
  const total = PACE.reduce((n, p) => n + (counts[p.kind] ?? 0), 0);
  return (
    <div className="fixed bottom-6 left-6 z-[70] w-60 rounded-2xl border border-edge bg-panel/95 p-4 shadow-pop backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-fg-dim">
          Room mood · last 30s
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide room mood"
          className="text-fg-dim hover:text-fg"
        >
          ✕
        </button>
      </div>
      {hands > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-3 py-2 text-sm font-bold text-accent">
          <span className="text-lg">✋</span> {hands} hand{hands === 1 ? '' : 's'} raised
        </div>
      )}
      <div className="space-y-2">
        {PACE.map((p) => {
          const c = counts[p.kind] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <div key={p.kind}>
              <div className="mb-0.5 flex items-center justify-between text-xs font-semibold text-fg">
                <span>
                  {p.emoji} {p.label}
                </span>
                <span className="tabular-nums text-fg-dim">{c}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {total === 0 && hands === 0 && (
        <p className="mt-2 text-xs text-fg-dim">No signals yet. Press G/M to toggle.</p>
      )}
    </div>
  );
}
