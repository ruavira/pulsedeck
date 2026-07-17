import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function aiDisabledResponse() {
  return Response.json(
    { aiDisabled: true, error: 'AI features are not configured (ANTHROPIC_API_KEY unset).' },
    { status: 501 },
  );
}

let _client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

/** Call Claude expecting a single JSON object back; parses defensively. */
export async function claudeJson<T>(system: string, user: string, maxTokens = 8000): Promise<T> {
  const msg = await getAnthropic().messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  // Strip code fences if present, find outermost JSON object
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI returned no JSON');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export const DECK_SCHEMA_GUIDE = `Slides use this exact JSON shape (TypeScript types shown loosely):
{
  "title": string,                     // deck title
  "theme": {                           // pick ONE pack that fits the topic + tone
    "pack": "ice"|"sky"|"teal"|"sunrise"|"navy"|"aurora"|"sand"|"pop"
  },
  "slides": [
    {
      "kind": "content" | "poll" | "wordcloud" | "quiz" | "qa" | "scale" | "open_text",
      "title": string,                 // slide heading (short, punchy)
      "body": {
        // content slides:
        "blocks"?: [
          {"type":"heading","text":string} |
          {"type":"text","text":string} |               // 1-3 short sentences max
          {"type":"bullets","items":[string]} |          // 2-6 items, <=8 words each
          {"type":"quote","text":string,"attribution":string} |
          {"type":"bigStat","value":string,"label":string}  // value e.g. "87%", "3.2x", "$4B"
        ],
        // OPTIONAL visual: a 2-4 word photo search phrase for a full-bleed
        // background image on THIS slide (concrete & photographable, e.g.
        // "solar farm sunset", "city skyline night", "team collaboration").
        "imageQuery"?: string,
        // interactive slides:
        "prompt"?: string,             // the question shown to the audience
        "options"?: [string],          // poll/quiz: 2-6 options
        "correct"?: [number],          // quiz only: indexes of correct options
        "min"?: number, "max"?: number, "minLabel"?: string, "maxLabel"?: string  // scale
      },
      "settings": {
        "layout"?: "title"|"statement"|"full"|"cards"|"stats"|"columns",
        "multiSelect"?: boolean,       // poll
        "maxWords"?: number,           // wordcloud (default 3)
        "timeLimitSec"?: number,       // quiz (15-45 sensible)
        "points"?: number,             // quiz base points (default 1000)
        "showResultsLive"?: boolean
      }
    }
  ]
}

THEME — pick the pack that matches the subject/tone:
  ice = clean bright corporate/tech (default) · sky = calm mid-blue, dim rooms ·
  teal = healthcare/wellness · sunrise = warm, optimistic · navy = serious, dark venues ·
  aurora = bold premium keynote (indigo/violet) · sand = warm editorial/human.

CONTENT LAYOUTS — VARY them for a designed, high-end feel (never make every slide the same):
  "title"     = opening or section-break slide (heading, centered).
  "statement" = ONE punchy line that fills the slide — use for big ideas / transitions.
  "cards"     = a set of 2-6 parallel points → put a short "bullets" block (each item <=8 words)
                and set layout "cards"; each item becomes a numbered card in a grid.
  "stats"     = 2-4 key numbers → include that many "bigStat" blocks (+ optional heading) with
                layout "stats"; they render as a row of stat cards. Prefer this over prose for data.
  "columns"   = compare/contrast or two related short lists; layout "columns".
  "full"      = default mixed content (heading + text/bullets/quote).

IMAGERY — add "imageQuery" to roughly HALF of the content slides for a full-bleed photo behind
the text: always the opening "title" slide, most "statement" slides, and a few "full" slides. Use a
concrete, photographable 2-4 word phrase. Do NOT add imageQuery to "stats"/"cards"/"columns" slides
(a photo behind stat cards hurts legibility) or to interactive slides — those stay clean.

Rules: slides must be presentation-grade — terse, high-signal, no filler. Reach for "stats"
whenever you cite numbers and "cards" whenever you list parallel points — that visual variety is
what makes the deck look designed. Interleave interactive slides between content slides for rhythm
(roughly 1 interaction per 2-3 content slides). Quiz options must be plausible; exactly the indexes
in "correct" are right. First slide: kind "content", layout "title", with a heading block and an
imageQuery. Output ONLY the JSON object.`;
