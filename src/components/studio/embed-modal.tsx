'use client';
// "Embed in Gamma (or any site)" helper. One-click copy of the deck-scoped embed
// URL (or an <iframe> snippet). The URL follows whatever session is live, so it's
// pasted into the host once and reused for every future session.

import { useState } from 'react';
import { Modal, Segmented } from './modal';
import { Button } from '@/components/shared/ui';
import { appOrigin, copyText } from './studio-api';

const WIDGETS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'poll', label: 'Poll' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'wordcloud', label: 'Word cloud' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'qa', label: 'Q&A' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'join', label: 'Join QR' },
];

export function EmbedModal({
  open,
  onClose,
  deckId,
  themePack,
}: {
  open: boolean;
  onClose: () => void;
  deckId: string;
  themePack?: string;
}) {
  const [widget, setWidget] = useState('auto');
  const [copied, setCopied] = useState<'url' | 'iframe' | null>(null);

  const theme = themePack && themePack !== 'ice' ? `&theme=${themePack}` : '';
  const url = `${appOrigin()}/embed/deck/${deckId}/${widget}?preset=gamma${theme}`;
  const iframe = `<iframe src="${url}" style="width:100%;height:500px;border:0" title="PulseDeck live"></iframe>`;

  const copy = async (kind: 'url' | 'iframe', text: string) => {
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Embed in Gamma (or any site)" wide>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-fg-dim">
          Drop this into a Gamma <strong className="text-fg">Embed</strong> card (or any
          iframe host). It&rsquo;s deck-scoped, so you paste it{' '}
          <strong className="text-fg">once</strong> — it follows whatever session is live
          each time you go live. No re-pasting per session.
        </p>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-fg-dim">Widget</p>
          <Segmented value={widget} options={WIDGETS} onChange={setWidget} ariaLabel="Embed widget" />
          <p className="mt-1.5 text-xs text-fg-dim">
            {widget === 'auto'
              ? 'Mirrors the current live slide — poll, word cloud, scale, open text, Q&A, and so on. The easiest choice: one embed covers the whole deck.'
              : `Shows the live ${WIDGETS.find((w) => w.value === widget)?.label} when that slide is open, and a friendly waiting card otherwise.`}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-fg-dim">Embed URL</p>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-edge bg-panel-2 px-3 py-2.5 font-mono text-xs text-fg">
              {url}
            </code>
            <Button size="sm" onClick={() => void copy('url', url)}>
              {copied === 'url' ? 'Copied ✓' : 'Copy'}
            </Button>
          </div>
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => void copy('iframe', iframe)}>
              {copied === 'iframe' ? 'Copied iframe ✓' : 'Copy <iframe> code instead'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-panel-2/60 px-4 py-3 text-sm text-fg-dim">
          <p className="mb-1 font-semibold text-fg">In Gamma, on the embed card:</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              Set <strong className="text-fg">Link display → Embed</strong> (not Preview).
            </li>
            <li>
              Turn <strong className="text-fg">Load through a proxy → off</strong> — it&rsquo;s a live
              app, not a static page.
            </li>
          </ul>
          <p className="mt-2 text-xs">
            Then present Gamma and drive open/close from your phone remote. Suggested card heights
            and more hosts are in <code className="font-mono">docs/embeds.md</code>.
          </p>
        </div>
      </div>
    </Modal>
  );
}
