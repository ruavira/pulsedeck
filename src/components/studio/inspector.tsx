'use client';
// Right-hand inspector: per-kind configuration forms for the selected slide.

import { useState } from 'react';
import type { ContentBlock, Slide, SlideBody, SlideSettings } from '@/lib/types';
import { Input } from '@/components/shared/ui';
import { BlockEditor } from './block-editor';
import { Field, Segmented, Toggle } from './modal';
import { KIND_META } from './slide-kinds';
import { getSpeedBonus, type StudioSlideSettings } from './studio-api';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from './icons';

export type PatchSlide = (fn: (s: Slide) => Slide, coalesce?: boolean) => void;

export function Inspector({ slide, patch }: { slide: Slide; patch: PatchSlide }) {
  const meta = KIND_META[slide.kind];
  const setBody = (b: Partial<SlideBody>, coalesce = true) =>
    patch((s) => ({ ...s, body: { ...s.body, ...b } }), coalesce);
  const setSettings = (v: Partial<StudioSlideSettings>, coalesce = false) =>
    patch((s) => ({ ...s, settings: { ...s.settings, ...v } as SlideSettings }), coalesce);

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2 text-fg-dim">
        <meta.icon width={16} height={16} />
        <span className="text-xs font-semibold uppercase tracking-wider">{meta.label} slide</span>
      </div>

      <Field label="Slide title" hint="Shown in the slide rail and on the remote.">
        <Input
          value={slide.title}
          placeholder="Untitled slide"
          onChange={(e) => patch((s) => ({ ...s, title: e.target.value }), true)}
        />
      </Field>

      {slide.kind === 'content' && <ContentForm slide={slide} patch={patch} setSettings={setSettings} />}
      {slide.kind === 'poll' && <PollForm slide={slide} setBody={setBody} setSettings={setSettings} />}
      {slide.kind === 'wordcloud' && <WordcloudForm slide={slide} setBody={setBody} setSettings={setSettings} />}
      {slide.kind === 'quiz' && <QuizForm slide={slide} setBody={setBody} setSettings={setSettings} />}
      {slide.kind === 'scale' && <ScaleForm slide={slide} setBody={setBody} />}
      {slide.kind === 'ranking' && <RankingForm slide={slide} setBody={setBody} />}
      {slide.kind === 'open_text' && <PromptOnlyForm slide={slide} setBody={setBody} label="Prompt" />}
      {slide.kind === 'timer' && <TimerForm slide={slide} setSettings={setSettings} />}
      {slide.kind === 'breathing' && <BreathingForm slide={slide} setBody={setBody} setSettings={setSettings} />}
      {slide.kind === 'qa' && (
        <p className="rounded-xl border border-edge bg-panel-2/60 px-4 py-3 text-sm leading-relaxed text-fg-dim">
          A dedicated Q&amp;A moment: the stage shows the live question wall and the audience can
          submit and upvote questions. Moderation lives on your phone remote.
        </p>
      )}

      <Field label="Speaker notes" hint="Private — shown only to you on the phone remote during a live show.">
        <textarea
          className="min-h-[72px] w-full resize-y rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[15px] text-fg placeholder:text-fg-dim/70 transition-colors focus:border-accent focus:outline-none"
          value={slide.settings.notes ?? ''}
          placeholder="Notes to yourself for this slide…"
          onChange={(e) => setSettings({ notes: e.target.value }, true)}
        />
      </Field>
    </div>
  );
}

type SetBody = (b: Partial<SlideBody>, coalesce?: boolean) => void;
type SetSettings = (v: Partial<StudioSlideSettings>, coalesce?: boolean) => void;

function PromptField({ slide, setBody, label = 'Prompt' }: { slide: Slide; setBody: SetBody; label?: string }) {
  return (
    <Field label={label} hint="The question your audience sees, big, on stage and on phones.">
      <textarea
        className="min-h-[76px] w-full resize-y rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[15px] text-fg placeholder:text-fg-dim/70 transition-colors focus:border-accent focus:outline-none"
        value={slide.body.prompt ?? ''}
        placeholder="Type your question…"
        onChange={(e) => setBody({ prompt: e.target.value }, true)}
      />
    </Field>
  );
}

function PromptOnlyForm({ slide, setBody, label }: { slide: Slide; setBody: SetBody; label: string }) {
  return <PromptField slide={slide} setBody={setBody} label={label} />;
}

// ---------- content ----------
function ContentForm({
  slide,
  patch,
  setSettings,
}: {
  slide: Slide;
  patch: PatchSlide;
  setSettings: SetSettings;
}) {
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState('');
  const [bgSource, setBgSource] = useState<'photo' | 'gif'>('photo');
  const hasBg = !!slide.body.backgroundImage;

  const imageQueryFor = (): string => {
    if (slide.body.imageQuery?.trim()) return slide.body.imageQuery.trim();
    const heading = (slide.body.blocks ?? []).find(
      (b): b is Extract<ContentBlock, { type: 'heading' }> => b.type === 'heading',
    );
    return (heading?.text || slide.title || '').trim();
  };

  const shuffleImage = async () => {
    const query = imageQueryFor();
    if (!query) {
      setImgErr('Add a slide title or heading first.');
      return;
    }
    setImgBusy(true);
    setImgErr('');
    try {
      const endpoint = bgSource === 'gif' ? '/api/media/gif' : '/api/media/stock';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variant: Math.floor(Math.random() * 1000) }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.status === 501) {
        setImgErr(
          bgSource === 'gif'
            ? 'GIF search needs a Giphy key on the server.'
            : 'Stock photos are not configured on the server.',
        );
      } else if (res.ok && data.url) {
        patch((s) => ({ ...s, body: { ...s.body, backgroundImage: data.url, imageQuery: query } }));
      } else {
        setImgErr(data.error === 'not_found' ? 'No photo found — try a different title.' : 'Could not fetch a photo.');
      }
    } catch {
      setImgErr('Network error — try again.');
    } finally {
      setImgBusy(false);
    }
  };

  const removeImage = () =>
    patch((s) => {
      const body = { ...s.body };
      delete body.backgroundImage;
      return { ...s, body };
    });

  return (
    <>
      <Field label="Layout">
        <Segmented
          ariaLabel="Slide layout"
          value={slide.settings.layout ?? 'title'}
          options={[
            { value: 'title', label: 'Title' },
            { value: 'statement', label: 'Statement' },
            { value: 'full', label: 'Full' },
            { value: 'cards', label: 'Cards' },
            { value: 'stats', label: 'Stats' },
            { value: 'columns', label: 'Columns' },
            { value: 'split', label: 'Split' },
            { value: 'media', label: 'Media' },
          ]}
          onChange={(layout) => setSettings({ layout })}
        />
      </Field>

      <Field label="Background" hint="A full-bleed stock photo or animated GIF behind the text (best on Title / Statement / Full).">
        <div className="mb-2">
          <Segmented
            ariaLabel="Background source"
            value={bgSource}
            options={[
              { value: 'photo', label: 'Photo' },
              { value: 'gif', label: 'GIF' },
            ]}
            onChange={setBgSource}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={shuffleImage}
            disabled={imgBusy}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-edge bg-panel-2 px-4 text-sm font-semibold text-fg transition-colors hover:border-accent/60 disabled:opacity-50"
          >
            {imgBusy
              ? 'Finding…'
              : hasBg
                ? `Shuffle ${bgSource === 'gif' ? 'GIF' : 'photo'}`
                : `Add a ${bgSource === 'gif' ? 'GIF' : 'photo'}`}
          </button>
          {hasBg && (
            <button
              type="button"
              onClick={removeImage}
              disabled={imgBusy}
              className="inline-flex min-h-[40px] items-center rounded-full px-3 text-sm font-medium text-fg-dim transition-colors hover:text-fg disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {imgErr && <p className="mt-1.5 text-xs text-red">{imgErr}</p>}
      </Field>
      <Field label="Animation">
        <Segmented
          ariaLabel="Slide animation"
          value={slide.settings.animation ?? 'fade'}
          options={[
            { value: 'fade', label: 'Fade' },
            { value: 'slide', label: 'Slide' },
            { value: 'zoom', label: 'Zoom' },
            { value: 'none', label: 'None' },
          ]}
          onChange={(animation) => setSettings({ animation })}
        />
      </Field>
      <Toggle
        checked={slide.settings.buildAnimation ?? false}
        onChange={(v) => setSettings({ buildAnimation: v })}
        label="Build in elements"
        hint="Bullets, cards and stats animate in one by one as the slide appears. Respects reduced-motion."
      />
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-dim">Blocks</span>
        <BlockEditor
          blocks={slide.body.blocks ?? []}
          onChange={(blocks, coalesce) =>
            patch((s) => ({ ...s, body: { ...s.body, blocks } }), coalesce ?? false)
          }
        />
      </div>
    </>
  );
}

// ---------- option list (poll / quiz / ranking) ----------
function OptionList({
  options,
  onChange,
  min = 2,
  max = 8,
  correct,
  onCorrectChange,
  optionImages,
  onImagesChange,
}: {
  options: string[];
  onChange: (options: string[], coalesce?: boolean) => void;
  min?: number;
  max?: number;
  correct?: number[];
  onCorrectChange?: (correct: number[]) => void;
  optionImages?: string[];
  onImagesChange?: (imgs: string[]) => void;
}) {
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  // Keep images array parallel to options (pad/trim to the same length).
  const imgAt = (i: number) => optionImages?.[i] || '';
  const setImgs = (mut: (arr: string[]) => string[]) => {
    if (!onImagesChange) return;
    const base = options.map((_, i) => optionImages?.[i] ?? '');
    onImagesChange(mut(base));
  };
  const pickImage = async (i: number) => {
    const query = (options[i] || '').trim();
    if (!query) return;
    setImgBusy(i);
    try {
      const res = await fetch('/api/media/stock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variant: Math.floor(Math.random() * 1000) }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) setImgs((arr) => arr.map((v, j) => (j === i ? data.url! : v)));
    } finally {
      setImgBusy(null);
    }
  };
  const clearImage = (i: number) => setImgs((arr) => arr.map((v, j) => (j === i ? '' : v)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (correct && onCorrectChange) {
      onCorrectChange(correct.map((c) => (c === i ? j : c === j ? i : c)));
    }
    setImgs((arr) => {
      const n = [...arr];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const remove = (i: number) => {
    onChange(options.filter((_, j) => j !== i));
    if (correct && onCorrectChange) {
      onCorrectChange(correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)));
    }
    setImgs((arr) => arr.filter((_, j) => j !== i));
  };
  const toggleCorrect = (i: number) => {
    if (!correct || !onCorrectChange) return;
    onCorrectChange(correct.includes(i) ? correct.filter((c) => c !== i) : [...correct, i].sort((a, b) => a - b));
  };

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {correct && onCorrectChange && (
            <input
              type="checkbox"
              checked={correct.includes(i)}
              onChange={() => toggleCorrect(i)}
              aria-label={`Mark option ${i + 1} as correct`}
              className="h-5 w-5 shrink-0 accent-(--color-emerald)"
            />
          )}
          <Input
            value={opt}
            aria-label={`Option ${i + 1}`}
            placeholder={`Option ${i + 1}`}
            className="min-h-[40px] py-2"
            onChange={(e) =>
              onChange(
                options.map((o, j) => (j === i ? e.target.value : o)),
                true,
              )
            }
          />
          {onImagesChange &&
            (imgAt(i) ? (
              <button
                type="button"
                aria-label={`Remove image for option ${i + 1}`}
                onClick={() => clearImage(i)}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent"
                title="Remove image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgAt(i)} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-xs font-bold text-white opacity-0 hover:opacity-100">
                  ×
                </span>
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Add image for option ${i + 1}`}
                disabled={imgBusy === i || !(options[i] || '').trim()}
                onClick={() => void pickImage(i)}
                title="Add a stock image (from the option text)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-fg-dim transition-colors hover:text-fg disabled:opacity-30"
              >
                {imgBusy === i ? '…' : '🖼'}
              </button>
            ))}
          <button
            type="button"
            aria-label={`Move option ${i + 1} up`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-fg-dim transition-colors hover:text-fg disabled:opacity-30"
          >
            <IconArrowUp width={13} height={13} />
          </button>
          <button
            type="button"
            aria-label={`Move option ${i + 1} down`}
            disabled={i === options.length - 1}
            onClick={() => move(i, 1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-fg-dim transition-colors hover:text-fg disabled:opacity-30"
          >
            <IconArrowDown width={13} height={13} />
          </button>
          <button
            type="button"
            aria-label={`Remove option ${i + 1}`}
            disabled={options.length <= min}
            onClick={() => remove(i)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-red transition-colors hover:bg-red/10 disabled:opacity-30"
          >
            <IconTrash width={13} height={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={options.length >= max}
        onClick={() => onChange([...options, ''])}
        className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge text-sm font-medium text-fg-dim transition-colors hover:border-accent/60 hover:text-fg disabled:opacity-40"
      >
        <IconPlus width={14} height={14} /> Add option {options.length >= max && `(max ${max})`}
      </button>
    </div>
  );
}

// ---------- poll ----------
function PollForm({ slide, setBody, setSettings }: { slide: Slide; setBody: SetBody; setSettings: SetSettings }) {
  return (
    <>
      <PromptField slide={slide} setBody={setBody} />
      <Field label="Options" hint="2–8 options. Tap 🖼 to make it a picture poll.">
        <OptionList
          options={slide.body.options ?? []}
          onChange={(options, co) => setBody({ options }, co ?? false)}
          optionImages={slide.body.optionImages}
          onImagesChange={(optionImages) =>
            setBody({ optionImages: optionImages.some(Boolean) ? optionImages : undefined })
          }
        />
      </Field>
      <div className="space-y-1">
        <Toggle
          checked={slide.settings.multiSelect ?? false}
          onChange={(v) => setSettings({ multiSelect: v })}
          label="Multiple choices"
          hint="Let people pick more than one option."
        />
        <Toggle
          checked={slide.settings.showResultsLive ?? true}
          onChange={(v) => setSettings({ showResultsLive: v })}
          label="Show results live"
          hint="Bars grow on stage while voting is open."
        />
      </div>
    </>
  );
}

// ---------- wordcloud ----------
function WordcloudForm({
  slide,
  setBody,
  setSettings,
}: {
  slide: Slide;
  setBody: SetBody;
  setSettings: SetSettings;
}) {
  return (
    <>
      <PromptField slide={slide} setBody={setBody} />
      <Field label="Words per person" hint="How many words each participant can submit.">
        <Segmented
          ariaLabel="Words per person"
          value={String(slide.settings.maxWords ?? 3)}
          options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: n }))}
          onChange={(n) => setSettings({ maxWords: Number(n) })}
        />
      </Field>
    </>
  );
}

// ---------- quiz ----------
function QuizForm({ slide, setBody, setSettings }: { slide: Slide; setBody: SetBody; setSettings: SetSettings }) {
  const timeLimit = slide.settings.timeLimitSec ?? 30;
  const points = slide.settings.points ?? 1000;
  return (
    <>
      <PromptField slide={slide} setBody={setBody} label="Question" />
      <Field label="Answers" hint="Tick the checkbox next to each correct answer.">
        <OptionList
          options={slide.body.options ?? []}
          onChange={(options, co) => setBody({ options }, co ?? false)}
          correct={slide.body.correct ?? []}
          onCorrectChange={(correct) => setBody({ correct }, false)}
          optionImages={slide.body.optionImages}
          onImagesChange={(optionImages) =>
            setBody({ optionImages: optionImages.some(Boolean) ? optionImages : undefined })
          }
        />
      </Field>
      {(slide.body.correct ?? []).length === 0 && (
        <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-fg">
          No correct answer marked — nobody can score on this question.
        </p>
      )}
      <Field label={`Time limit: ${timeLimit}s`}>
        <input
          type="range"
          min={10}
          max={120}
          step={5}
          value={timeLimit}
          aria-label="Time limit in seconds"
          aria-valuetext={`${timeLimit} seconds`}
          onChange={(e) => setSettings({ timeLimitSec: Number(e.target.value) }, true)}
          className="h-11 w-full accent-(--color-accent)"
        />
        <span className="flex justify-between text-xs text-fg-dim">
          <span>10s</span>
          <span>120s</span>
        </span>
      </Field>
      <Field label="Points" hint="Base points for a correct answer.">
        <Input
          type="number"
          min={0}
          max={10000}
          step={100}
          value={points}
          aria-label="Base points"
          onChange={(e) => {
            const n = Number(e.target.value);
            setSettings({ points: Number.isFinite(n) ? Math.max(0, Math.min(10000, Math.round(n))) : 1000 }, true);
          }}
        />
      </Field>
      <Toggle
        checked={getSpeedBonus(slide.settings)}
        onChange={(v) => setSettings({ speedBonus: v })}
        label="Speed bonus (max +20%) — accuracy-first by default"
        hint="Faster correct answers earn a small bonus."
      />
    </>
  );
}

// ---------- scale ----------
function ScaleForm({ slide, setBody }: { slide: Slide; setBody: SetBody }) {
  const min = slide.body.min ?? 1;
  const max = slide.body.max ?? 5;
  const clampNum = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  return (
    <>
      <PromptField slide={slide} setBody={setBody} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min">
          <Input
            type="number"
            value={min}
            aria-label="Scale minimum"
            onChange={(e) => setBody({ min: clampNum(e.target.value, 1) }, true)}
          />
        </Field>
        <Field label="Max">
          <Input
            type="number"
            value={max}
            aria-label="Scale maximum"
            onChange={(e) => setBody({ max: clampNum(e.target.value, 5) }, true)}
          />
        </Field>
      </div>
      {min >= max && (
        <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-fg">
          Min must be less than max.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min label">
          <Input
            value={slide.body.minLabel ?? ''}
            placeholder="e.g. Disagree"
            aria-label="Label for the minimum"
            onChange={(e) => setBody({ minLabel: e.target.value }, true)}
          />
        </Field>
        <Field label="Max label">
          <Input
            value={slide.body.maxLabel ?? ''}
            placeholder="e.g. Agree"
            aria-label="Label for the maximum"
            onChange={(e) => setBody({ maxLabel: e.target.value }, true)}
          />
        </Field>
      </div>
    </>
  );
}

// ---------- timer ----------
function TimerForm({ slide, setSettings }: { slide: Slide; setSettings: SetSettings }) {
  const duration = slide.settings.durationSec ?? 300;
  const mmss = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  return (
    <>
      <Field label="Duration (seconds)" hint={`Counts down from ${mmss} (mm:ss). Starts automatically on stage.`}>
        <Input
          type="number"
          min={5}
          max={5940}
          step={5}
          value={duration}
          aria-label="Countdown duration in seconds"
          onChange={(e) => {
            const n = Number(e.target.value);
            setSettings(
              { durationSec: Number.isFinite(n) ? Math.max(5, Math.min(5940, Math.round(n))) : 300 },
              true,
            );
          }}
        />
      </Field>
      <Field label="Label" hint="Shown above the countdown, e.g. “Back in”.">
        <Input
          value={slide.settings.timerLabel ?? ''}
          placeholder="Back in"
          aria-label="Timer label"
          onChange={(e) => setSettings({ timerLabel: e.target.value }, true)}
        />
      </Field>
    </>
  );
}

// ---------- breathing ----------
function BreathingForm({
  slide,
  setBody,
  setSettings,
}: {
  slide: Slide;
  setBody: SetBody;
  setSettings: SetSettings;
}) {
  const clampInt = (v: string, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const secField = (
    label: string,
    value: number,
    onValue: (n: number) => void,
    fallback: number,
  ) => (
    <Field label={label}>
      <Input
        type="number"
        min={2}
        max={12}
        value={value}
        aria-label={`${label} in seconds`}
        onChange={(e) => onValue(clampInt(e.target.value, fallback, 2, 12))}
      />
    </Field>
  );
  return (
    <>
      <Field label="Prompt (optional)" hint="A calm line under the exercise, e.g. “Let's take a breath together.”">
        <Input
          value={slide.body.prompt ?? ''}
          placeholder="Let's take a breath together."
          aria-label="Breathing prompt"
          onChange={(e) => setBody({ prompt: e.target.value }, true)}
        />
      </Field>
      <Field label="Rounds" hint="1–12 breath cycles, then a calm “Well done.”">
        <Input
          type="number"
          min={1}
          max={12}
          value={slide.settings.rounds ?? 5}
          aria-label="Number of breath rounds"
          onChange={(e) => setSettings({ rounds: clampInt(e.target.value, 5, 1, 12) }, true)}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {secField('Inhale (s)', slide.settings.inhaleSec ?? 4, (n) => setSettings({ inhaleSec: n }, true), 4)}
        {secField('Hold (s)', slide.settings.holdSec ?? 4, (n) => setSettings({ holdSec: n }, true), 4)}
        {secField('Exhale (s)', slide.settings.exhaleSec ?? 6, (n) => setSettings({ exhaleSec: n }, true), 6)}
      </div>
    </>
  );
}

// ---------- ranking ----------
function RankingForm({ slide, setBody }: { slide: Slide; setBody: SetBody }) {
  return (
    <>
      <PromptField slide={slide} setBody={setBody} />
      <Field label="Items to rank" hint="2–8 items; the audience drags them into order.">
        <OptionList
          options={slide.body.options ?? []}
          onChange={(options, co) => setBody({ options }, co ?? false)}
        />
      </Field>
    </>
  );
}
