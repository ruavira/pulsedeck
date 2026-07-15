'use client';
// Join ritual primitives shared by stage chrome, lobby and the QR spotlight.

import { QRCodeSVG } from 'qrcode.react';
import { APP_ORIGIN } from '@/lib/config';

/** APP_ORIGIN is a baked placeholder until first deploy — fall back to the live origin. */
export function resolveOrigin(): string {
  if (APP_ORIGIN.startsWith('http')) return APP_ORIGIN;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Human-readable join host, e.g. `pulsedeck.app` (no protocol). */
export function joinHost(): string {
  return resolveOrigin().replace(/^https?:\/\//, '');
}

export function joinUrl(code: string): string {
  return `${resolveOrigin()}/j/${code}`;
}

/** White QR card, readable from the back row. */
export function JoinQr({
  code,
  size = 180,
  pad = 12,
  className = '',
}: {
  code: string;
  size?: number;
  /** White quiet-zone padding in px (QR needs it for scannability). */
  pad?: number;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-2xl bg-white ${className}`}
      style={{ padding: pad }}
      role="img"
      aria-label={`QR code — scan to join at ${joinHost()}/j with code ${code}`}
    >
      <QRCodeSVG
        value={joinUrl(code)}
        size={size}
        bgColor="#ffffff"
        fgColor="#061826"
        level="M"
        aria-hidden="true"
      />
    </div>
  );
}
