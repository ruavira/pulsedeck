'use client';
// Go-live flow: pre-launch settings → create session → stage link, remote QR,
// audience join code, copy buttons. Remembers the live session per deck so
// re-entering the editor shows a "live now" notice.

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Deck } from '@/lib/types';
import { Button, JoinCode, Spinner } from '@/components/shared/ui';
import { presenterPost, storeSessionKey } from '@/lib/presenter-api';
import { Modal, Toggle } from './modal';
import {
  appOrigin,
  copyText,
  getLiveSession,
  setLiveSession,
  type SessionCreateResult,
} from './studio-api';
import { IconExternal, IconPlay, IconWarn } from './icons';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? 'Copied ✓' : 'Copy link'}
    </Button>
  );
}

export function GoLiveModal({
  open,
  onClose,
  deck,
  presenterKey,
}: {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  presenterKey: string;
}) {
  const [step, setStep] = useState<'configure' | 'creating' | 'ready'>('configure');
  const [qaEnabled, setQaEnabled] = useState(true);
  const [qaModerated, setQaModerated] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SessionCreateResult | null>(null);
  const existing = getLiveSession(deck.id);

  const close = () => {
    setStep('configure');
    setError('');
    setSession(null);
    onClose();
  };

  const goLive = async () => {
    setStep('creating');
    setError('');
    try {
      const res = await presenterPost<SessionCreateResult>(
        `/api/decks/${deck.id}/sessions`,
        presenterKey,
        { settings: { qaEnabled, qaModerated } },
      );
      storeSessionKey(res.sessionId, presenterKey);
      setLiveSession(deck.id, {
        sessionId: res.sessionId,
        code: res.code,
        createdAt: new Date().toISOString(),
      });
      setSession(res);
      setStep('ready');
    } catch {
      setError('Could not start the session — check your connection and try again.');
      setStep('configure');
    }
  };

  const origin = appOrigin();
  const keyQ = `?key=${encodeURIComponent(presenterKey)}`;

  return (
    <Modal open={open} onClose={close} title={step === 'ready' ? 'You are live!' : 'Present this deck'}>
      {step === 'configure' && (
        <div className="space-y-4">
          {existing && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
              <IconWarn className="mt-0.5 shrink-0 text-amber" width={16} height={16} />
              <p className="text-sm leading-relaxed text-fg">
                A session for this deck (code <JoinCode code={existing.code} className="text-sm" />) may
                still be live. Going live again starts a brand-new session with a new code.
              </p>
            </div>
          )}
          <p className="text-sm leading-relaxed text-fg-dim">
            Your deck is frozen into the session at go-live — edits you make afterwards won&rsquo;t
            affect the running show. {deck.slides.length} slide{deck.slides.length === 1 ? '' : 's'} ready.
          </p>
          {deck.slides.length === 0 && (
            <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-fg">
              This deck has no slides yet — the stage will be empty.
            </p>
          )}
          <div className="rounded-xl border border-edge p-2">
            <Toggle
              checked={qaEnabled}
              onChange={(v) => setQaEnabled(v)}
              label="Audience Q&A"
              hint="People can submit and upvote questions on any slide."
            />
            <Toggle
              checked={qaModerated}
              onChange={setQaModerated}
              disabled={!qaEnabled}
              label="Moderate questions first"
              hint="Questions stay hidden until you approve them from the remote."
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-sm text-red">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void goLive()}>
              <IconPlay width={14} height={14} /> Go live
            </Button>
          </div>
        </div>
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <Spinner />
          <p aria-live="polite" className="font-semibold text-fg">
            Creating your session…
          </p>
          <p className="text-sm text-fg-dim">Snapshotting slides and minting a join code.</p>
        </div>
      )}

      {step === 'ready' && session && (
        <div className="space-y-4" aria-live="polite">
          <div className="rounded-xl border border-edge bg-panel-2/60 px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-dim">
              Audience joins at {origin.replace(/^https?:\/\//, '')}/j with code
            </p>
            <JoinCode code={session.code} className="mt-1 block text-4xl" />
            <div className="mt-1.5">
              <CopyButton text={`${origin}${session.joinPath}`} label="audience join link" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-edge px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-fg">Stage — the big screen</p>
              <p className="text-xs text-fg-dim">Open on the projector or share it in your call.</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <CopyButton text={`${origin}${session.stagePath}${keyQ}`} label="stage link" />
              <Button
                size="sm"
                onClick={() => window.open(`${session.stagePath}${keyQ}`, '_blank', 'noopener')}
              >
                <IconExternal width={14} height={14} /> Open stage
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-edge px-4 py-3">
            <div className="shrink-0 rounded-lg bg-white p-2">
              <QRCodeSVG
                value={`${origin}${session.remotePath}${keyQ}`}
                size={104}
                marginSize={1}
                title="QR code linking to the presenter remote"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">Remote — your phone</p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-dim">
                Scan to control slides, open/close voting and moderate Q&amp;A from your pocket.
              </p>
              <div className="mt-1.5 -ml-3">
                <CopyButton text={`${origin}${session.remotePath}${keyQ}`} label="remote link" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
