'use client';
// Content-slide block list editor: add / remove / reorder blocks of every ContentBlock type,
// with image upload to /api/upload and YouTube/mp4 auto-detection for video blocks.

import { useRef, useState } from 'react';
import type { ContentBlock } from '@/lib/types';
import { detectVideoProvider, providerLabel } from '@/lib/video';
import { Button, Input } from '@/components/shared/ui';
import { Menu, Segmented, Toggle } from './modal';
import { uploadImage, uploadVideo } from './studio-api';
import { IconArrowDown, IconArrowUp, IconTrash, IconUpload } from './icons';

const BLOCK_LABEL: Record<ContentBlock['type'], string> = {
  heading: 'Heading',
  text: 'Text',
  bullets: 'Bullets',
  image: 'Image',
  video: 'Video',
  quote: 'Quote',
  bigStat: 'Big stat',
};

function newBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'heading':
      return { type, text: 'Heading' };
    case 'text':
      return { type, text: '' };
    case 'bullets':
      return { type, items: ['First point'] };
    case 'image':
      return { type, url: '', alt: '', fit: 'contain' };
    case 'video':
      return { type, url: '', provider: 'youtube' };
    case 'quote':
      return { type, text: '', attribution: '' };
    case 'bigStat':
      return { type, value: '42%', label: '' };
  }
}

// Video provider detection lives in @/lib/video (YouTube, Vimeo, Loom, direct files).

const textareaCls =
  'w-full rounded-xl bg-panel-2 border border-edge px-4 py-3 text-[15px] text-fg placeholder:text-fg-dim/70 focus:border-accent focus:outline-none transition-colors min-h-[76px] resize-y';

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[], coalesce?: boolean) => void;
}) {
  const set = (i: number, b: ContentBlock, coalesce = true) =>
    onChange(
      blocks.map((x, j) => (j === i ? b : x)),
      coalesce,
    );
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge px-4 py-5 text-center text-sm text-fg-dim">
          No blocks yet — add a heading or some text below.
        </p>
      )}
      {blocks.map((block, i) => (
        <div key={i} className="rounded-xl border border-edge bg-panel-2/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-dim">
              {BLOCK_LABEL[block.type]}
            </span>
            <span className="flex gap-1">
              <IconButton label={`Move ${BLOCK_LABEL[block.type]} block up`} onClick={() => move(i, -1)} disabled={i === 0}>
                <IconArrowUp width={14} height={14} />
              </IconButton>
              <IconButton
                label={`Move ${BLOCK_LABEL[block.type]} block down`}
                onClick={() => move(i, 1)}
                disabled={i === blocks.length - 1}
              >
                <IconArrowDown width={14} height={14} />
              </IconButton>
              <IconButton label={`Remove ${BLOCK_LABEL[block.type]} block`} danger onClick={() => remove(i)}>
                <IconTrash width={14} height={14} />
              </IconButton>
            </span>
          </div>
          <BlockFields block={block} onChange={(b, co) => set(i, b, co)} />
        </div>
      ))}
      <Menu
        label="Add block"
        align="left"
        items={(Object.keys(BLOCK_LABEL) as ContentBlock['type'][]).map((t) => ({
          label: BLOCK_LABEL[t],
          onSelect: () => onChange([...blocks, newBlock(t)]),
        }))}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel transition-colors disabled:opacity-30 ${
        danger ? 'text-red hover:bg-red/10' : 'text-fg-dim hover:text-fg hover:bg-panel-2'
      }`}
    >
      {children}
    </button>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock, coalesce?: boolean) => void;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <Input
          value={block.text}
          placeholder="Heading text"
          aria-label="Heading text"
          onChange={(e) => onChange({ ...block, text: e.target.value }, true)}
        />
      );
    case 'text':
      return (
        <textarea
          className={textareaCls}
          value={block.text}
          placeholder="Body text — **bold** and *italic* supported"
          aria-label="Body text"
          onChange={(e) => onChange({ ...block, text: e.target.value }, true)}
        />
      );
    case 'bullets':
      return (
        <textarea
          className={textareaCls}
          value={block.items.join('\n')}
          placeholder={'One bullet per line'}
          aria-label="Bullet points, one per line"
          onChange={(e) => onChange({ ...block, items: e.target.value.split('\n') }, true)}
          onBlur={(e) =>
            onChange(
              { ...block, items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) },
              true,
            )
          }
        />
      );
    case 'image':
      return <ImageBlockFields block={block} onChange={onChange} />;
    case 'video':
      return (
        <div className="space-y-2">
          <Input
            value={block.url}
            placeholder="YouTube, Vimeo or Loom link — or a .mp4/.webm URL"
            aria-label="Video URL"
            onChange={(e) =>
              onChange(
                { ...block, url: e.target.value, provider: detectVideoProvider(e.target.value) },
                true,
              )
            }
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-dim">
              Detected:{' '}
              <span className="font-semibold text-fg">
                {providerLabel[detectVideoProvider(block.url)]}
              </span>
            </span>
            <VideoUploadButton
              onUploaded={(url) => onChange({ ...block, url, provider: 'mp4' })}
            />
          </div>
          <Toggle
            checked={block.autoplay ?? false}
            onChange={(v) => onChange({ ...block, autoplay: v })}
            label="Autoplay on stage"
          />
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2">
          <textarea
            className={textareaCls}
            value={block.text}
            placeholder="Quote text"
            aria-label="Quote text"
            onChange={(e) => onChange({ ...block, text: e.target.value }, true)}
          />
          <Input
            value={block.attribution ?? ''}
            placeholder="Attribution (optional)"
            aria-label="Quote attribution"
            onChange={(e) => onChange({ ...block, attribution: e.target.value }, true)}
          />
        </div>
      );
    case 'bigStat':
      return (
        <div className="space-y-2">
          <Input
            value={block.value}
            placeholder="e.g. 87%"
            aria-label="Stat value"
            onChange={(e) => onChange({ ...block, value: e.target.value }, true)}
          />
          <Input
            value={block.label ?? ''}
            placeholder="Label (optional)"
            aria-label="Stat label"
            onChange={(e) => onChange({ ...block, label: e.target.value }, true)}
          />
        </div>
      );
  }
}

function ImageBlockFields({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'image' }>;
  onChange: (b: ContentBlock, coalesce?: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const url = await uploadImage(file);
      onChange({ ...block, url });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={block.url}
          placeholder="Image URL"
          aria-label="Image URL"
          onChange={(e) => onChange({ ...block, url: e.target.value }, true)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload width={14} height={14} />
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          aria-label="Upload image file"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
      {err && (
        <p role="alert" className="text-xs text-red">
          {err}
        </p>
      )}
      {block.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt={block.alt ?? ''} className="max-h-28 rounded-lg border border-edge object-contain" />
      )}
      <Input
        value={block.alt ?? ''}
        placeholder="Alt text (describe the image)"
        aria-label="Image alt text"
        onChange={(e) => onChange({ ...block, alt: e.target.value }, true)}
      />
      <Segmented
        ariaLabel="Image fit"
        value={block.fit ?? 'contain'}
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
        ]}
        onChange={(fit) => onChange({ ...block, fit })}
      />
    </div>
  );
}

/** Upload a video (≤200MB, mp4/webm/mov) directly to storage via signed URL. */
function VideoUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState('');

  return (
    <span className="flex items-center gap-2">
      {state === 'error' && (
        <span role="alert" className="text-xs text-red">
          {error}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        aria-label="Upload video file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > 200 * 1024 * 1024) {
            setState('error');
            setError('Max 200MB — for bigger videos, host on YouTube/Vimeo/Loom and paste the URL.');
            return;
          }
          setState('uploading');
          setError('');
          try {
            const url = await uploadVideo(file);
            onUploaded(url);
            setState('idle');
          } catch {
            setState('error');
            setError('Upload failed — try again.');
          }
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={state === 'uploading'}
        onClick={() => inputRef.current?.click()}
      >
        <IconUpload width={13} height={13} />
        {state === 'uploading' ? 'Uploading…' : 'Upload video'}
      </Button>
    </span>
  );
}
