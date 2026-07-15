'use client';
// Loads Google Fonts on demand by injecting a <link> into <head>, deduped across
// the app. Used by the brand-kit font pairing so the stage + editor render the
// deck's chosen fonts. No-op when no families are requested.

import { useEffect } from 'react';
import { googleFontsHref } from '@/lib/font-pairings';

export function useGoogleFonts(families: (string | undefined)[]): void {
  const href = googleFontsHref(families.filter((f): f is string => !!f));
  useEffect(() => {
    if (!href || typeof document === 'undefined') return;
    if (document.querySelector(`link[data-brandfont][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-brandfont', '');
    document.head.appendChild(link);
    // Leave the link in place — fonts are cheap to keep and may be reused across
    // slides/decks; removing risks a flash if the same font is requested again.
  }, [href]);
}
