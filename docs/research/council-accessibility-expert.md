## 1. Sharpest accessibility critiques of the four

- **Kahoot! is the worst offender and the cautionary tale.** Speed-based scoring (0/1000/2000 pts) is a disability tax: it punishes screen-reader users (SR announcement of 4 answer options takes 8–15s), motor-impaired users, and anyone on slow venue Wi-Fi identically. Its answer buttons are pure color+shape (red/blue/yellow/green triangles/diamonds) — red/green confusable for ~8% of men with deutan/protan CVD; shape helps but contrast on projectors is untested. Lobby music/timers autoplay with no reduced-motion or audio-off default. The 2025 "Accuracy mode" (correctness-only, unlimited time) is the tacit admission — but it's opt-in per-session, so most hosts never enable it.
- **Mentimeter** is the only one with visible a11y investment (Open Dyslexic font Apr 2026, auto alt-text May 2026), but word clouds are inherently inaccessible: font-size-encodes-frequency is unreadable to SR users and low-vision users, and its default theme palettes are decorative, not CVD-safe. Six new themes shipped Oct 2025 with no published contrast ratios.
- **AhaSlides**: Safari/Mac inconsistencies reported — Safari is what iPhone audience members actually use; browser inconsistency IS the accessibility failure at a live event. No documented WCAG conformance statement, no reduced-motion handling in Spinner Wheel/leaderboard animations.
- **Wooclap**: mobile participant text-sizing/navigation complaints = viewport/zoom failures (WCAG 1.4.4/1.4.10). SMS fallback is genuinely great for a11y (works on any phone, no JS) — the one feature worth stealing conceptually.
- None of the four publishes a current VPAT/ACR for the *audience* surface; all test the editor, not the phone in row 40.

## 2. MUST do / MUST avoid

**Must do:**
- Audience UI at WCAG 2.2 AA minimum: 44×44px touch targets, visible focus, full keyboard/SR operability, `aria-live="polite"` for state changes ("Question 3 of 10 open"), semantic buttons not div-onclick.
- Charts: Okabe-Ito or similar CVD-safe palette; never color-only encoding — add direct labels + patterns/position. Word cloud must have a toggleable ranked-list view (same data, table form) on both projector and phone.
- Projector mode: 7:1 contrast target (venue projectors lose ~30–50% contrast in lit rooms), min 28pt equivalent body text, dark-text-on-light default.
- Quiz equity: default scoring = correctness-only or generous time-window banding (any answer within window scores equally); per-participant "extended time ×1.5/×2" flag the presenter can grant; server-timestamps answer receipt, not client render, so slow radios aren't penalized.
- `prefers-reduced-motion` honored everywhere: leaderboard confetti, countdown pulses, word-cloud animation all get static equivalents. Audio (timer music) off by default, opt-in.
- Question text readable BEFORE answering opens (Kahoot's screen-split — question on projector, answers on phone — fails anyone who can't see the screen). Put full question + options on the participant device, always.
- Countdown conveyed non-visually: aria-live announcements at 30/10/5s, plus a numeric timer, not just a shrinking bar.

**Must avoid:** speed scoring as default; color-only answer buttons; autoplaying audio; CAPTCHA-style join friction (2-step pattern join blocks SR users — use rate-limiting server-side instead); infinite word-cloud animation; contrast-unchecked custom themes.

## 3. Trade-offs I'd accept

- Ship word clouds visually stunning but with a one-tap list view — don't kill the feature, dual-render it (cheap: same Supabase payload).
- Accept losing "Kahoot energy": correctness-first scoring with a small, capped speed bonus (≤10% of points) as the compromise; equity beats adrenaline for a 300-person mixed audience.
- Skip full SR support in the presenter/editor UI for tomorrow's build (one known presenter); spend that time making the *audience* path flawless — that's where the unknown 300 users with unknown needs are.
- Accept reduced-motion mode looking plainer; static leaderboard reveal is fine.
- Defer VPAT documentation; do NOT defer the palette, targets, timers, and aria-live wiring — those cost hours now, are unfixable mid-event.