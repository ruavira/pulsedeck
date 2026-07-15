// Curated Google-Fonts pairings for the brand kit. Client-safe (no secrets).
// Each pairing names a heading + body family; the renderer loads them from Google
// Fonts and applies them via CSS vars. 'System' = no custom font (the default).

export interface FontPairing {
  id: string;
  name: string;
  heading: string; // Google Font family for headings
  body: string; // Google Font family for body text
}

export const FONT_PAIRINGS: readonly FontPairing[] = [
  { id: 'system', name: 'System (default)', heading: '', body: '' },
  { id: 'fraunces-inter', name: 'Fraunces · Inter', heading: 'Fraunces', body: 'Inter' },
  { id: 'playfair-source', name: 'Playfair · Source Sans', heading: 'Playfair Display', body: 'Source Sans 3' },
  { id: 'space-inter', name: 'Space Grotesk · Inter', heading: 'Space Grotesk', body: 'Inter' },
  { id: 'dmserif-dmsans', name: 'DM Serif · DM Sans', heading: 'DM Serif Display', body: 'DM Sans' },
  { id: 'sora', name: 'Sora', heading: 'Sora', body: 'Sora' },
  { id: 'poppins', name: 'Poppins', heading: 'Poppins', body: 'Poppins' },
  { id: 'libre-lora', name: 'Libre Franklin · Lora', heading: 'Libre Franklin', body: 'Lora' },
] as const;

/** Find the pairing whose heading/body match a deck theme (for the picker's active state). */
export function pairingFor(heading?: string, body?: string): string {
  if (!heading && !body) return 'system';
  return (
    FONT_PAIRINGS.find((p) => p.heading === heading && p.body === body)?.id ?? 'custom'
  );
}

/** Build a Google Fonts CSS2 URL for the given families (deduped, weighted). */
export function googleFontsHref(families: string[]): string | null {
  const uniq = Array.from(new Set(families.filter(Boolean)));
  if (uniq.length === 0) return null;
  const parts = uniq.map(
    (f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`,
  );
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** CSS font-family value with a sensible fallback stack. */
export function fontStack(family?: string, kind: 'heading' | 'body' = 'body'): string | undefined {
  if (!family) return undefined;
  const fallback = kind === 'heading' ? 'Georgia, serif' : 'system-ui, sans-serif';
  return `"${family}", ${fallback}`;
}
