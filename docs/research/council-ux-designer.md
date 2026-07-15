(1) SHARPEST CRITIQUES
- Mentimeter: polish masks a presenter-view problem — the presenter juggles browser tabs; Mentimote exists because the core stage UX fails. Static-image PPT import destroys hierarchy: 16px body text rasterized then projected. Result screens (word clouds especially) degrade legibly past ~200 entries with no density management.
- Kahoot!: "colorful and cluttered" is fatal on a dark stage — saturated purple backgrounds with mid-contrast white text fail at distance. Speed-scoring plus 20-char answer caps forces audience heads-down typing on phones during the timer: peak cognitive load for both sides simultaneously. Character avatars/music default-on = wrong register for professional rooms; they had to ship three "hosting experiences" to patch one bad default.
- AhaSlides: no undo in the editor is disqualifying — presenters edit minutes before going live; one mis-drag with no recovery is a panic generator. Reconnect UI shipped only Jan 2025, admitting the audience previously stared at silently dead screens.
- Wooclap: densest editor of the four ("difficult navigation"); no phone remote/moderation means the presenter is chained to the lectern. Mobile participant text-sizing complaints = untested audience viewport.
- All four: nobody designs the projected screen as a distinct surface. Same layout serves editor, presenter, and 30-foot view.

(2) MUST DO
- Three distinct rendered surfaces from one state: Stage (projected: min 40px type, WCAG-AAA contrast on true dark, join QR + short code persistently in a corner, never a scrollbar), Presenter (current + next slide, response count ticking, one giant "Advance" target, Q&A queue peek), Phone (participant: single question per viewport, 56px+ tap targets, thumb-zone submit, zero scroll to answer).
- Advance = spacebar/click-anywhere/arrow. One control. Presenter under load cannot find small buttons.
- Word cloud density governor: cap rendered terms (~60), merge stems, minimum rendered font 20px on stage.
- Connection states as first-class UI: audience sees "Reconnecting…" with cached last question; presenter sees live connected-count so they know when Wi-Fi dies before the audience revolts.
- Empty states that instruct: every activity pre-response shows the QR + "waiting for answers" animation, never a blank chart.
- Motion: 150–250ms ease-out on result bars, count-up numbers; zero decorative motion; leaderboard reveal is the ONE earned animation moment.
- Undo, autosave, and a rehearsal/test mode (none of the four has real preview-with-fake-audience).

(3) TRADE-OFFS ACCEPTED
- Kill theming flexibility: ship 2 themes (dark stage, light room), both pre-validated for contrast. Customization is where legibility dies.
- Accept static-image PPT import IF imported slides are auto-checked for minimum projected text size and flagged — parity with competitors, honesty they lack.
- Drop speed-scoring by default (accuracy mode); lose some Kahoot adrenaline, gain fairness on venue Wi-Fi and 5 fewer seconds of heads-down phone panic.
- Batch realtime updates (500ms aggregation) over per-vote animation: slightly less "alive," vastly more stable at 300 concurrent on Supabase realtime.