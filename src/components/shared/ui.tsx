'use client';
// Shared UI primitives — ALL agents use these instead of ad-hoc buttons/inputs
// so the product feels like one system.

import { forwardRef } from 'react';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const btnStyles: Record<BtnVariant, string> = {
  primary:
    'bg-accent text-white hover:brightness-110 active:scale-[0.98] shadow-accent-glow',
  secondary: 'bg-panel-2 text-fg border border-edge hover:border-accent/60',
  ghost: 'bg-transparent text-fg-dim hover:text-fg hover:bg-panel-2',
  danger: 'bg-red/90 text-white hover:bg-red',
  success: 'bg-emerald text-white hover:brightness-110',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }
>(function Button({ variant = 'primary', size = 'md', className = '', ...props }, ref) {
  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[44px]',
    md: 'px-5 py-2.5 text-[15px] min-h-[44px]',
    lg: 'px-7 py-3.5 text-lg min-h-[52px]',
  };
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${btnStyles[variant]} ${className}`}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-xl bg-panel-2 border border-edge px-4 py-3 text-[16px] text-fg placeholder:text-fg-dim focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-[border-color,box-shadow] min-h-[48px] ${className}`}
        {...props}
      />
    );
  },
);

export function Card({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl bg-panel border border-edge shadow-soft ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-fg-dim/40 border-t-accent ${className}`}
    />
  );
}

export function Pill({
  tone = 'default',
  className = '',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'accent' | 'live' | 'dim' }) {
  const tones = {
    default: 'bg-panel-2 text-fg border border-edge',
    accent: 'bg-accent-soft text-accent border border-accent/40',
    live: 'bg-red/15 text-red border border-red/40',
    dim: 'bg-panel-2 text-fg-dim border border-edge',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

/** Big-screen join code chip, readable from the back row. */
export function JoinCode({ code, className = '' }: { code: string; className?: string }) {
  return (
    <span
      className={`font-mono font-bold tracking-[0.25em] text-cyan ${className}`}
      aria-label={`Join code ${code.split('').join(' ')}`}
    >
      {code}
    </span>
  );
}
