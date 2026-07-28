# PulseDeck × Gamma

You built your deck in Gamma and you love how it looks. PulseDeck gives you the
live layer — polls, word clouds, quizzes, Q&A — without asking you to rebuild
anything. There are **three ways** to run the two together; pick per talk.

## Mode 1 — Import from Gamma (present from the PulseDeck Stage)

Bring your Gamma **visuals** into PulseDeck as full-bleed slides, weave live
activities between them, and present the whole thing from the PulseDeck Stage.
This is the most seamless option: one screen, one remote, no embed cards.

1. In Gamma: open your deck → **Share → Export** → **Export as PDF** (best
   fidelity; PowerPoint `.pptx` also works).
2. In PulseDeck studio: **Import → From Gamma…**.
3. Drop the file. Each page renders to a full-bleed slide — pixel-for-pixel your
   Gamma design.
4. On the **Weave in live moments** step, use **+ Add live activity** between any
   slides to drop in a poll, word cloud, quiz, scale, ranking, open text, or Q&A.
5. **Add to deck.** Reorder or edit anything afterwards in the editor, then
   **Present** as normal.

Because the visuals are ordinary slides once imported, everything else in
PulseDeck just works: theming, the phone remote, the audience join QR, results
export after the session.

> Fidelity note: **PDF** preserves your Gamma look exactly (each page is an
> image). **PPTX** extracts editable text/shapes, so complex Gamma layouts may
> reflow — use it when you want the text back, not pixel fidelity.

## Mode 2 — Embed a live widget (keep presenting inside Gamma)

Prefer to keep presenting *inside* Gamma? Don't move anything. Drop a live
PulseDeck widget onto a Gamma slide with an **Embed** card. See
[`embeds.md`](./embeds.md) for the deck-scoped URL, the two Gamma card settings
to flip once, and suggested card heights.

Use **Import → From Gamma…** in studio, or the **Embed** button in the editor top
bar, to get either flow.

## Mode 3 — Runtime overlay + automatic Gamma Sync

For a facilitator who must stay inside Gamma without operating two controls,
use the facilitator-side Gamma Sync browser extension. It watches the active
Gamma card, advances the mapped PulseDeck session through the existing
authenticated presenter API, and injects a public live-interaction panel only
on join/activity cards. Ordinary Gamma cards remain unobstructed, and the Gamma
file itself needs no permanent iframe blocks. The presenter key stays out of
public URLs and the phone remote remains a manual fallback. See
[`gamma-sync.md`](./gamma-sync.md).

## Which mode?

| You want… | Use |
|---|---|
| One screen, drive open/close from your phone, no per-slide setup | **Mode 1 — Import** |
| To keep your live presentation inside Gamma, add interactivity in a spot or two | **Mode 2 — Embed** |
| To keep presenting in Gamma with one-control automatic navigation | **Mode 3 — Runtime overlay + Gamma Sync** |
| Pixel-exact Gamma visuals on the big screen | **Mode 1 — Import (PDF)** |
| The Gamma text back as editable slides | **Mode 1 — Import (PPTX)** |

All three modes run the **same live session** underneath — the audience joins the same
way and the results are identical. The only difference is what fills the screen
you present from.
