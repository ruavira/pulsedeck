// PulseDeck Embeds shell — strips all app chrome and makes the surface
// transparent so the widget blends into whatever host frames it (Gamma, Notion,
// any iframe). It sizes to its content (no forced viewport height) and is not
// indexable. Theme + accent are applied per-widget inside the page.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PulseDeck Embed',
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Neutralize the root <body> chrome (ink background, min-h-dvh flex column)
          so the embed is transparent and auto-fits its content in the iframe. */}
      <style>{`html,body{background:transparent !important;min-height:0 !important;}
body{display:block !important;}`}</style>
      {children}
    </>
  );
}
