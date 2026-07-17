'use client';
// Shown in the canvas area when a deck has zero slides: template starters.

import { Card } from '@/components/shared/ui';
import { IconFile, IconPlay, IconSmile, IconSparkle } from './icons';

export function FirstRun({
  onBlank,
  onDemoTour,
  onIcebreakers,
  onAi,
}: {
  onBlank: () => void;
  onDemoTour: () => void;
  onIcebreakers: () => void;
  onAi: () => void;
}) {
  const options = [
    {
      icon: <IconFile width={20} height={20} />,
      title: 'Blank',
      body: 'Start from an empty content slide and build your own flow.',
      onClick: onBlank,
    },
    {
      icon: <IconPlay width={20} height={20} />,
      title: 'Demo tour',
      body: 'A 6-slide starter with a poll, word cloud, quiz, scale and Q&A — perfect first run.',
      onClick: onDemoTour,
    },
    {
      icon: <IconSmile width={20} height={20} />,
      title: 'Icebreakers',
      body: 'A 7-slide warm-up: two truths and a lie, this-or-that, a word cloud, a guided breath and a break timer.',
      onClick: onIcebreakers,
    },
    {
      icon: <IconSparkle width={20} height={20} />,
      title: 'AI generate',
      body: 'Describe your topic and get a full interactive deck in seconds.',
      onClick: onAi,
    },
  ];
  return (
    <div className="mx-auto w-full max-w-2xl text-center">
      <h2 className="text-2xl font-bold text-fg">Let&rsquo;s build your deck</h2>
      <p className="mt-1.5 text-sm text-fg-dim">Pick a starting point — everything stays editable.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <Card key={o.title} className="p-0">
            <button
              type="button"
              onClick={o.onClick}
              className="flex h-full w-full flex-col items-center gap-2.5 rounded-2xl p-5 text-center transition-colors hover:bg-accent-soft/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                {o.icon}
              </span>
              <span className="font-semibold text-fg">{o.title}</span>
              <span className="text-xs leading-relaxed text-fg-dim">{o.body}</span>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
