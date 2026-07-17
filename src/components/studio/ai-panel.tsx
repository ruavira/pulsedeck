'use client';
// AI generation modal: Topic → deck, Outline → deck, Add quiz.
// Degrades gracefully when the server has no ANTHROPIC_API_KEY (501 {aiDisabled:true}).

import { useEffect, useId, useState } from 'react';
import type { DeckTheme, ImageProvider, ImageStyle, Slide } from '@/lib/types';
import { Button, Input, Spinner } from '@/components/shared/ui';
import { Field, Modal, Segmented, Toggle } from './modal';
import { KIND_META } from './slide-kinds';
import { IconSparkle, IconWarn } from './icons';
import { IMAGE_PROVIDERS, IMAGE_STYLES, imageProviderMeta } from '@/lib/image-catalog';

type StockSourceId = 'unsplash' | 'pexels' | 'pixabay';
interface ProviderInfo {
  available: ImageProvider[];
  stock: boolean;
  stockSources: StockSourceId[];
  gif: boolean;
  plan: 'free' | 'pro';
}

const STOCK_LABELS: Record<StockSourceId, string> = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
};

export type AiApplyMode = 'replace' | 'append' | 'create';

export interface AiResult {
  title?: string;
  theme?: DeckTheme;
  slides: Slide[];
}

type Tab = 'topic' | 'outline' | 'quiz';
type Status = 'idle' | 'loading' | 'ready' | 'error' | 'disabled';

const textareaCls =
  'w-full rounded-xl bg-panel-2 border border-edge px-4 py-3 text-[15px] text-fg placeholder:text-fg-dim/70 focus:border-accent focus:outline-none transition-colors resize-y';

export function AiPanel({
  open,
  onClose,
  context,
  busyApply = false,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** 'editor': offers Replace/Append. 'create': single Create-deck action. */
  context: 'editor' | 'create';
  busyApply?: boolean;
  onApply: (result: AiResult, how: AiApplyMode) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('topic');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<AiResult | null>(null);

  // topic tab
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [aiImages, setAiImages] = useState(false);
  const [imageStyle, setImageStyle] = useState<ImageStyle>('auto');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('auto');
  const [stockSource, setStockSource] = useState<'auto' | StockSourceId>('auto');
  const [providers, setProviders] = useState<ProviderInfo | null>(null);
  // outline tab
  const [outline, setOutline] = useState('');
  // quiz tab
  const [quizSource, setQuizSource] = useState<'topic' | 'text'>('topic');
  const [quizTopic, setQuizTopic] = useState('');
  const [quizText, setQuizText] = useState('');
  const [quizCount, setQuizCount] = useState(5);

  const countId = useId();
  const quizCountId = useId();

  // Load which image engines are actually configured on this deployment (+ plan)
  // so the model picker can Pro-gate and disable engines missing a key.
  useEffect(() => {
    if (!open || providers) return;
    let alive = true;
    void fetch('/api/media/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProviderInfo | null) => {
        if (alive && d) setProviders(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, providers]);

  const isPro = providers?.plan === 'pro';
  const availableSet = new Set(providers?.available ?? ['auto', 'pollinations']);
  // A provider is selectable when it's wired + configured on the server, and
  // (for paid engines) the user is on Pro.
  const providerSelectable = (id: ImageProvider): boolean => {
    const meta = imageProviderMeta(id);
    if (!meta) return false;
    if (!availableSet.has(id)) return false;
    if (meta.tier === 'paid' && !isPro) return false;
    return true;
  };
  const selectedProviderMeta = imageProviderMeta(imageProvider);

  const switchTab = (t: Tab) => {
    setTab(t);
    setStatus('idle');
    setResult(null);
    setError('');
  };

  const run = async (path: string, body: Record<string, unknown>, isQuiz: boolean) => {
    setStatus('loading');
    setError('');
    setResult(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        aiDisabled?: boolean;
        error?: string;
        title?: string;
        theme?: DeckTheme;
        slides?: Slide[];
      };
      if (res.status === 501 || data.aiDisabled) {
        setStatus('disabled');
        return;
      }
      if (!res.ok || !Array.isArray(data.slides) || data.slides.length === 0) {
        setError(data.error ?? 'Generation failed — try again.');
        setStatus('error');
        return;
      }
      setResult({
        title: isQuiz ? undefined : data.title,
        theme: isQuiz ? undefined : data.theme,
        slides: data.slides,
      });
      setStatus('ready');
    } catch {
      setError('Network error — check your connection and try again.');
      setStatus('error');
    }
  };

  const generate = () => {
    // AI on → send style/engine; AI off (stock) → send the chosen stock library.
    const imageOpts = aiImages
      ? { imageStyle, imageProvider }
      : stockSource !== 'auto'
        ? { stockSource }
        : {};
    if (tab === 'topic') {
      void run(
        '/api/ai/deck',
        {
          topic: topic.trim(),
          audience: audience.trim() || undefined,
          tone: tone || undefined,
          slideCount,
          aiImages,
          ...imageOpts,
        },
        false,
      );
    } else if (tab === 'outline') {
      void run('/api/ai/deck', { outline: outline.trim(), slideCount, aiImages, ...imageOpts }, false);
    } else {
      void run(
        '/api/ai/quiz',
        quizSource === 'topic'
          ? { topic: quizTopic.trim(), count: quizCount }
          : { sourceText: quizText.trim(), count: quizCount },
        true,
      );
    }
  };

  const canGenerate =
    tab === 'topic'
      ? topic.trim().length > 1
      : tab === 'outline'
        ? outline.trim().length > 3
        : quizSource === 'topic'
          ? quizTopic.trim().length > 1
          : quizText.trim().length > 20;

  const apply = (how: AiApplyMode) => {
    if (!result) return;
    void onApply(result, how);
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate with AI" wide>
      <div role="tablist" aria-label="AI generation mode" className="mb-5 flex gap-1.5">
        {(
          [
            ['topic', 'Topic → deck'],
            ['outline', 'Outline → deck'],
            ['quiz', 'Add quiz'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-edge bg-panel-2 text-fg-dim hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {status === 'disabled' && (
        <div className="rounded-xl border border-edge bg-panel-2/60 px-5 py-6 text-center">
          <IconWarn className="mx-auto mb-3 text-amber" width={28} height={28} />
          <p className="font-semibold text-fg">AI is off</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-fg-dim">
            Set <code className="rounded bg-panel px-1.5 py-0.5 text-cyan">ANTHROPIC_API_KEY</code> on the
            server to enable generation. Everything else works without it.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>
            Back to editing
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-edge bg-panel-2/60 px-5 py-10 text-center">
          <Spinner />
          <p aria-live="polite" className="font-semibold text-fg">
            {tab === 'quiz' ? 'Writing quiz questions…' : 'Designing your deck…'}
          </p>
          <p className="text-sm text-fg-dim">
            {tab === 'quiz'
              ? 'Fair, fun and timed — usually 10–20 seconds.'
              : 'Slides, polls, a word cloud and a quiz — usually 15–40 seconds.'}
          </p>
        </div>
      )}

      {status === 'ready' && result && (
        <div>
          <p className="mb-3 text-sm text-fg-dim">
            {result.title ? (
              <>
                Generated <span className="font-semibold text-fg">&ldquo;{result.title}&rdquo;</span> —{' '}
              </>
            ) : (
              'Generated '
            )}
            {result.slides.length} slide{result.slides.length === 1 ? '' : 's'}. Review, then apply:
          </p>
          <ul role="list" className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-edge p-2">
            {result.slides.map((s, i) => {
              const meta = KIND_META[s.kind] ?? KIND_META.content;
              const snippet =
                s.body?.prompt ??
                s.body?.blocks?.map((b) => ('text' in b ? b.text : '')).find(Boolean) ??
                '';
              return (
                <li key={s.id ?? i} className="flex items-center gap-2.5 rounded-lg bg-panel-2/60 px-3 py-2">
                  <span className="w-5 text-right text-xs tabular-nums text-fg-dim">{i + 1}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <meta.icon width={13} height={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{s.title || meta.label}</span>
                    {snippet && <span className="block truncate text-xs text-fg-dim">{snippet}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={generate} disabled={busyApply}>
              Regenerate
            </Button>
            {context === 'create' ? (
              <Button onClick={() => apply('create')} disabled={busyApply}>
                {busyApply ? 'Creating…' : 'Create deck'}
              </Button>
            ) : tab === 'quiz' ? (
              <Button onClick={() => apply('append')} disabled={busyApply}>
                Add {result.slides.length} quiz slide{result.slides.length === 1 ? '' : 's'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => apply('append')} disabled={busyApply}>
                  Append {result.slides.length} slides
                </Button>
                <Button onClick={() => apply('replace')} disabled={busyApply}>
                  Replace deck
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canGenerate) generate();
          }}
          className="space-y-4"
        >
          {tab === 'topic' && (
            <>
              <Field label="Topic">
                <Input
                  value={topic}
                  autoFocus
                  placeholder="e.g. The future of renewable energy"
                  onChange={(e) => setTopic(e.target.value)}
                />
              </Field>
              <Field label="Audience (optional)">
                <Input
                  value={audience}
                  placeholder="e.g. first-year engineering students"
                  onChange={(e) => setAudience(e.target.value)}
                />
              </Field>
              <Field label="Tone">
                <Segmented
                  ariaLabel="Tone"
                  value={tone}
                  options={[
                    { value: '', label: 'Default' },
                    { value: 'professional', label: 'Professional' },
                    { value: 'friendly', label: 'Friendly' },
                    { value: 'playful', label: 'Playful' },
                    { value: 'inspiring', label: 'Inspiring' },
                  ]}
                  onChange={setTone}
                />
              </Field>
            </>
          )}
          {tab === 'outline' && (
            <Field label="Your outline" hint="Paste markdown or plain text — headings become slides.">
              <textarea
                id="ai-outline"
                className={`${textareaCls} min-h-[160px]`}
                value={outline}
                autoFocus
                placeholder={'# My talk\n\n## Why this matters\n- point one\n- point two\n\n## Live poll idea…'}
                onChange={(e) => setOutline(e.target.value)}
              />
            </Field>
          )}
          {(tab === 'topic' || tab === 'outline') && (
            <div>
              <label htmlFor={countId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-dim">
                About {slideCount} slides
              </label>
              <input
                id={countId}
                type="range"
                min={3}
                max={24}
                value={slideCount}
                aria-valuetext={`${slideCount} slides`}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="h-11 w-full accent-(--color-accent)"
              />
              <div className="mt-3">
                <Toggle
                  checked={aiImages}
                  onChange={setAiImages}
                  label="AI-generated images"
                  hint="Bespoke images for hero slides (slower + uses AI credits). Off = curated stock photos."
                />
              </div>
              {!aiImages && (providers?.stockSources?.length ?? 0) > 1 && (
                <div className="mt-3">
                  <Field label="Stock library">
                    <Segmented
                      ariaLabel="Stock library"
                      value={stockSource}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        ...(providers?.stockSources ?? []).map((s) => ({
                          value: s,
                          label: STOCK_LABELS[s],
                        })),
                      ]}
                      onChange={setStockSource}
                    />
                  </Field>
                </div>
              )}
              {aiImages && (
                <div className="mt-4 space-y-4 rounded-xl border border-edge bg-panel-2/40 p-4">
                  <Field label="Image style" hint="Keeps every image in one coherent look.">
                    <Segmented
                      ariaLabel="Image style"
                      value={imageStyle}
                      options={IMAGE_STYLES.map((s) => ({ value: s.id, label: s.label }))}
                      onChange={setImageStyle}
                    />
                  </Field>
                  <Field label="Image engine">
                    <select
                      value={imageProvider}
                      onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
                      className="w-full rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[15px] text-fg transition-colors focus:border-accent focus:outline-none"
                    >
                      <optgroup label="Free">
                        {IMAGE_PROVIDERS.filter((p) => p.tier === 'free').map((p) => (
                          <option key={p.id} value={p.id} disabled={!providerSelectable(p.id)}>
                            {p.label} · {p.cost}
                            {p.wired && !availableSet.has(p.id) ? ' (add key)' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Premium (Pro)">
                        {IMAGE_PROVIDERS.filter((p) => p.tier === 'paid').map((p) => (
                          <option key={p.id} value={p.id} disabled={!providerSelectable(p.id)}>
                            {p.label} · {p.cost}
                            {!p.wired ? ' (soon)' : !availableSet.has(p.id) ? ' (add key)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <span className="mt-1 block text-xs text-fg-dim">
                      {selectedProviderMeta?.hint}
                      {selectedProviderMeta?.tier === 'paid' && !isPro
                        ? ' — Pro plan required.'
                        : ''}
                    </span>
                  </Field>
                </div>
              )}
            </div>
          )}
          {tab === 'quiz' && (
            <>
              <Segmented
                ariaLabel="Quiz source"
                value={quizSource}
                options={[
                  { value: 'topic', label: 'From a topic' },
                  { value: 'text', label: 'From source text' },
                ]}
                onChange={setQuizSource}
              />
              {quizSource === 'topic' ? (
                <Field label="Quiz topic">
                  <Input
                    value={quizTopic}
                    autoFocus
                    placeholder="e.g. Solar system trivia"
                    onChange={(e) => setQuizTopic(e.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Source text" hint="Questions are drawn strictly from this material.">
                  <textarea
                    className={`${textareaCls} min-h-[140px]`}
                    value={quizText}
                    autoFocus
                    placeholder="Paste the article, notes or docs to quiz on…"
                    onChange={(e) => setQuizText(e.target.value)}
                  />
                </Field>
              )}
              <div>
                <label
                  htmlFor={quizCountId}
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-dim"
                >
                  {quizCount} question{quizCount === 1 ? '' : 's'}
                </label>
                <input
                  id={quizCountId}
                  type="range"
                  min={1}
                  max={15}
                  value={quizCount}
                  aria-valuetext={`${quizCount} questions`}
                  onChange={(e) => setQuizCount(Number(e.target.value))}
                  className="h-11 w-full accent-(--color-accent)"
                />
              </div>
            </>
          )}

          {status === 'error' && (
            <p role="alert" className="rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-sm text-red">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={!canGenerate}>
              <IconSparkle width={16} height={16} /> Generate
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
