'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input } from '@/components/shared/ui';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';

export function ReportIssueButton({ reporterEmail }: { reporterEmail?: string | null }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [category, setCategory] = useState<'bug' | 'feedback' | 'feature_request' | 'question' | 'performance'>('bug');
  const [state, setState] = useState<SubmitState>('idle');
  const titleRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Dialog a11y: focus the first field on open, restore the trigger on close,
  // and close on Escape.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setCategory('bug');
    setState('idle');
  };

  const close = () => {
    setOpen(false);
    window.setTimeout(reset, 180);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim().length < 3) return;
    setState('sending');

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.from('bug_reports').insert({
        title: title.trim(),
        description: description.trim() || null,
        severity,
        category,
        reporter_email: reporterEmail ?? null,
        route: window.location.pathname,
        browser: navigator.userAgent,
        metadata: {
          feature_key: featureKeyForPath(window.location.pathname),
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      });
      if (error) throw error;
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-[42px] items-center rounded-full border border-edge bg-panel px-4 text-sm font-semibold text-fg shadow-pop transition hover:border-accent/60 hover:text-accent"
      >
        Report issue
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-5 sm:items-center">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={close}
            aria-hidden="true"
          />
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-issue-title"
            onSubmit={(event) => void submit(event)}
            className="relative w-full max-w-lg rounded-2xl border border-edge bg-panel p-5 shadow-modal"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-issue-title" className="text-lg font-bold text-fg">Report issue</h2>
                <p className="mt-1 text-sm text-fg-dim">This goes straight into the PulseDeck ops dashboard.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-fg-dim transition hover:bg-panel-2 hover:text-fg"
                aria-label="Close report issue"
              >
                ×
              </button>
            </div>

            {state === 'sent' ? (
              <div className="mt-5 rounded-xl border border-emerald/40 bg-emerald/10 px-4 py-5">
                <p className="font-semibold text-emerald">Sent. Thank you.</p>
                <p className="mt-1 text-sm text-fg-dim">We captured the page route and browser details with your note.</p>
                <Button type="button" className="mt-4" size="sm" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <label className="mt-5 block">
                  <span className="text-sm font-semibold text-fg">Title</span>
                  <Input
                    ref={titleRef}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What went wrong?"
                    minLength={3}
                    maxLength={160}
                    required
                    className="mt-2"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-fg">Details</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What were you doing, what did you expect, and what happened?"
                    rows={5}
                    className="mt-2 min-h-[130px] w-full resize-y rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[16px] text-fg placeholder:text-fg-dim/70 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-accent-soft"
                  />
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-semibold text-fg">Severity</span>
                    <select
                      value={severity}
                      onChange={(event) => setSeverity(event.target.value as typeof severity)}
                      className="mt-2 min-h-[44px] w-full rounded-xl border border-edge bg-panel-2 px-3 text-fg focus:border-accent focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-sm font-semibold text-fg">Type</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as typeof category)}
                      className="mt-2 min-h-[44px] w-full rounded-xl border border-edge bg-panel-2 px-3 text-fg focus:border-accent focus:outline-none"
                    >
                      <option value="bug">Bug</option>
                      <option value="feedback">Feedback</option>
                      <option value="feature_request">Feature request</option>
                      <option value="question">Question</option>
                      <option value="performance">Performance</option>
                    </select>
                  </label>
                </div>

                {state === 'error' && (
                  <p role="alert" className="mt-4 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
                    Could not send this report. Please try again.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={state === 'sending'}>
                    {state === 'sending' ? 'Sending…' : 'Send report'}
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}

function featureKeyForPath(pathname: string) {
  if (pathname.startsWith('/studio/')) return 'deck-builder';
  if (pathname.startsWith('/studio')) return 'studio-home';
  if (pathname.startsWith('/present') || pathname.startsWith('/remote')) return 'live-session';
  if (pathname.startsWith('/j')) return 'audience-join';
  if (pathname.startsWith('/account') || pathname.startsWith('/pricing')) return 'billing';
  return 'support-policy';
}
