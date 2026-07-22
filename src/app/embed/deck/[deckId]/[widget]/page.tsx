// Deck-scoped embed widget route:
//   /embed/deck/{deckId}/{widget}?theme=&accent=&compact=&preset=
// Next 16: params and searchParams are Promises — await them.
import { EmbedApp, type EmbedConfig, type EmbedWidget } from '@/components/embed/embed-app';
import { THEMES, type ThemeId } from '@/components/shared/themes';

const WIDGETS: readonly EmbedWidget[] = [
  'auto',
  'poll',
  'quiz',
  'ranking',
  'wordcloud',
  'qa',
  'leaderboard',
  'join',
];

type RawSearch = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Accept #rgb / #rrggbb only — the accent is the ONLY dynamic inline color. */
function sanitizeAccent(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : undefined;
}

function parseConfig(sp: RawSearch): EmbedConfig {
  const themeRaw = first(sp.theme);
  const theme = THEMES.some((t) => t.id === themeRaw) ? (themeRaw as ThemeId) : undefined;
  const compactRaw = first(sp.compact);
  const compact = compactRaw != null && compactRaw !== '0' && compactRaw !== 'false';
  const preset = first(sp.preset) === 'gamma' ? 'gamma' : undefined;
  return { theme, accent: sanitizeAccent(first(sp.accent)), compact, preset };
}

export default async function EmbedWidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string; widget: string }>;
  searchParams: Promise<RawSearch>;
}) {
  const { deckId, widget } = await params;
  const sp = await searchParams;
  const w = (WIDGETS.includes(widget as EmbedWidget) ? widget : 'auto') as EmbedWidget;
  return <EmbedApp deckId={deckId} widget={w} config={parseConfig(sp)} />;
}
