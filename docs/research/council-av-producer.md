## 1. Sharpest critiques (from the booth)

- **Mentimeter**: Best realtime layer of the four (Ably, five-nines) — copy that architecture instinct. But slide imports become static images, so presenter animations die, and the PowerPoint add-in is notoriously flaky mid-show. Embedded videos "glitchy" is a stage killer: video on the projector stuttering in front of 300 people. Join codes expiring ~2 days out breaks pre-printed signage/QR posters.
- **Kahoot!**: Speed-based scoring punishes people on bad venue wifi — the person at the back on 1 bar loses the quiz through no fault of theirs. Accuracy mode (2025) is the fix; default to that model. Lobby music/characters are uncontrollable AV noise unless toggled. "Kahoot smasher" bot floods are real; 2-step join exists because of it.
- **AhaSlides**: Reported connection drops needing full reload at ~40 simultaneous joins, and Safari/Mac inconsistencies — presenter Macs are half the market. Their Jan 2025 "Reconnecting…" UI is an admission. No preview/test mode = you can't rehearse. Unforgivable.
- **Wooclap**: 1,000-participant cap with word-cloud rendering degrading near it; no phone-based presenter control. SMS fallback is the one genuinely stage-smart feature here.

## 2. MUST do / MUST avoid

**MUST:**
- **Design for 16:9 1920x1080 as the canonical stage output**, with a presenter view (notes, next slide, timer, live join count) on a second output — that's your confidence monitor. Test ultrawide letterboxing; never assume the projector matches the laptop.
- **Permanent QR/join code per event**, printed-signage-safe, generated at creation, never expiring. Short URL + 6-char code as fallback when cameras fail.
- **Clicker support**: PageUp/PageDown/arrow keys/space/B-for-blackout MUST advance slides — every Logitech clicker is a keyboard emulator. This is the single most-forgotten feature.
- **Reconnect that resumes silently**: audience client survives wifi drop, phone lock, and tab background without losing state or requiring re-join. Presenter client survives a full browser refresh mid-show and returns to the current slide.
- **Preload everything**: next-slide prefetch, videos as locally-served MP4 (no YouTube embeds — venue firewalls block them), fonts self-hosted.
- **Accuracy-based scoring default**; speed scoring optional.
- **A "panic" state**: one keystroke to blank audience input, freeze the leaderboard, or drop to a static slide.
- **Big-room legibility**: minimum ~40pt equivalent body text, high-contrast theme, word clouds capped and legible from 30m.

**MUST avoid:** static-image slide import (keep video/animation working or clearly say so), autoplaying audio, expiring codes, waiting-room overflow behavior, speed scoring by default, any feature requiring venue wifi upload from the presenter machine beyond websockets.

## 3. Trade-offs I'd accept

- Drop fancy transitions for deterministic rendering — a boring crossfade that never tears beats a parallax that stutters on a hotel projector.
- Accept 1–2s aggregation latency on word clouds/results (batch updates every 500ms–1s) to keep 300 clients stable; per-keystroke realtime is showing off.
- One built-in polished theme > ten customizable ones; theming can wait, stability can't.
- Cap open-text at ~250 chars and throttle submissions per client — moderation and rendering both survive.
- Skip SMS fallback for tomorrow (telco setup won't happen in a day) but keep the audience payload tiny (<200KB initial load) so 3G-grade cellular works when venue wifi collapses — because it will.