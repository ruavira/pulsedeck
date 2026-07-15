'use client';
// The JOIN slide — a deliberate, full-screen join moment the presenter places
// wherever they want (open, after the break, before the quiz). Giant QR,
// code, plain-URL fallback, three-step instructions, and the live counter
// ticking up as the room joins.

import type { Slide } from '@/lib/types';
import { JoinCode } from '@/components/shared/ui';
import { JoinQr, joinHost } from './join-qr';
import { useParticipantCount } from './use-participant-count';

export function JoinSlide({
  slide,
  sessionId,
  code,
}: {
  slide: Slide;
  sessionId: string;
  code: string;
}) {
  const participants = useParticipantCount(sessionId, 3000);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[4vh] px-[6vw]">
      <h2 className="text-center font-bold leading-tight text-fg [font-size:clamp(2rem,4.5vw,3.75rem)] [text-wrap:balance]">
        {slide.title || 'Join in — phones out'}
      </h2>

      <div className="flex items-center gap-[5vw]">
        <JoinQr code={code} size={Math.min(380, 340)} pad={20} />
        <div className="flex flex-col gap-[3vh]">
          <div>
            <p className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-medium text-fg-dim">
              Scan, or go to <span className="font-bold text-fg">{joinHost()}/j</span>
            </p>
            <JoinCode code={code} className="mt-1 block [font-size:clamp(3rem,7vw,6rem)]" />
          </div>
          <ol className="flex flex-col gap-[1.2vh] text-[clamp(1rem,1.5vw,1.35rem)] text-fg-dim">
            {['Scan the QR with your camera', 'Pick a nickname', "You're in — no app, no account"].map(
              (step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ),
            )}
          </ol>
        </div>
      </div>

      <p
        className="text-[clamp(1.1rem,1.8vw,1.6rem)] font-semibold text-cyan"
        aria-live="polite"
        aria-atomic="true"
      >
        {participants == null || participants === 0
          ? 'Waiting for the first scan…'
          : `${participants} ${participants === 1 ? 'person is' : 'people are'} in`}
      </p>
    </div>
  );
}
