'use client';
// Studio interaction primitives: Modal, dropdown Menu, Toggle, ConfirmDialog,
// Field (labelled control), Segmented (radio pill group).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/shared/ui';
import { IconChevronDown, IconClose } from './icons';

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** When false, backdrop-click and Escape don't close (e.g. an action is in flight). */
  dismissible?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else {
      restoreRef.current?.focus?.();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && dismissible) {
            e.stopPropagation();
            onClose();
            return;
          }
          if (e.key !== 'Tab') return;
          // Keep focus inside the dialog (WCAG 2.4.3 / no-escape modal).
          const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (!focusables || focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (e.shiftKey && (active === first || active === dialogRef.current)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        className={`relative flex max-h-[88vh] w-full flex-col rounded-2xl border border-edge bg-panel shadow-modal ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-edge px-6 py-4">
          <h2 className="text-lg font-bold text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full text-fg-dim transition-colors hover:bg-panel-2 hover:text-fg"
          >
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export function Menu({
  label,
  items,
  align = 'right',
  variant = 'secondary',
  footnote,
}: {
  label: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  variant?: 'secondary' | 'ghost';
  footnote?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant={variant}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <IconChevronDown width={14} height={14} />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute z-40 mt-2 min-w-60 rounded-xl border border-edge bg-panel-2 p-1.5 shadow-pop"
          style={align === 'right' ? { right: 0 } : { left: 0 }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                item.danger ? 'text-red hover:bg-red/10' : 'text-fg hover:bg-panel'
              }`}
            >
              <span className="block font-medium">{item.label}</span>
              {item.hint && <span className="mt-0.5 block text-xs text-fg-dim">{item.hint}</span>}
            </button>
          ))}
          {footnote && (
            <p className="border-t border-edge px-3 pb-1.5 pt-2 text-xs text-fg-dim">{footnote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left transition-colors hover:bg-panel-2 disabled:opacity-40"
    >
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg-dim">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-edge bg-panel-2'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 rounded-full bg-fg transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} dismissible={!busy}>
      <p className="text-sm leading-relaxed text-fg-dim">{body}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fg-dim">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-dim">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-edge bg-panel-2 text-fg-dim hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
