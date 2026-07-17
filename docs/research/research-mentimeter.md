# Mentimeter Research Report (as of July 2026)

## 1. Feature inventory
- **Activity types (~13 interactive + content slides; free plan lists 23 slide types total):** Multiple Choice, Word Cloud, Open Ended, Scales, Ranking, Q&A, 2x2 Grid/Matrix, Pin on Image, 100 Points allocation, Quiz Competition (Select Answer + Type Answer, with leaderboard/countdown/music), Quick Form (Pro-only), Guess the Number [unverified exact current list]. Content slides: text, image, video, big number, instructions slide.
- Ranking, Pin on Image, 2x2 Grid, Word Cloud slides redesigned Oct 2025; LaTeX support in choices/legends (Oct 2025).
- **Moderation:** Q&A moderation (approve/reject/highlight/mark-answered via shareable moderator link, no license needed for moderator) — Pro/Conference/Enterprise only. Built-in profanity filter (multiple languages; enhanced across all text inputs May 2026). Audience upvoting on Q&A. Participants anonymous by default; optional participant names (2024) and SSO-verified participants (Enterprise, Apr 2025).
- **Branding/themes:** 6 new default themes Oct 2025 (14 retired); custom branding/colors/logo upload on Pro+ (logo upload Feb 2026). Mentimote phone remote (Pro+; Mentimote 2.0 with QR pairing Apr 2026). Open Dyslexic font (Apr 2026). Languages: Spanish, German (Feb 2026), Brazilian Portuguese (Apr 2026).

## 2. Pricing & limits (annual billing only — no monthly option)
- **Free:** $0. 50 participants/month (resets on account-creation date; 30-day lockout once hit; 8-hr rejoin grace). Unlimited presentations; max 100 slides/presentation. No Q&A moderation, import, export, private presentations.
- **Basic:** $14/presenter/mo ($11 education). Unlimited participants, import decks, Excel/PDF export.
- **Pro:** $28/presenter/mo ($17 education). Branding, Quick Form, embeds (PPT/Google Slides/Miro), Mentimote, team workspace, Q&A moderation.
- **Enterprise:** custom, ~10+ license minimum. SSO/SCIM, verified participants, workspace insights, custom data retention, success manager.
- **Conference one-month plans:** ~$350–$750 one-off.
- **Hard caps on paid plans:** Quiz slides max 2,000 simultaneous (overflow goes to a waiting room); >10,000 expected participants requires emailing Mentimeter 2 business days ahead.

## 3. AI features ("Menti AI", launched broadly Jan–Feb 2026; AI included for all users Feb 2026)
- **AI Menti Creator:** chat-based deck generation from prompt/agenda; accepts PDF uploads (Mar 2026).
- **AI Suggestions:** rewrites rough questions into 3 options with slide type (Oct 2025).
- **AI Quiz Generator:** topic → MC/true-false quiz.
- **AI Grouping** (live clustering of open-ended responses into named themes) + **Key Insights** summarization; AI usage tracking in Workspace Insights (Apr 2026).
- Quality: generally reviewed as solid for scaffolding/first drafts; independent quality benchmarking scarce [unverified]. Free-tier AI usage is capped with upgrade for more usage.

## 4. Import/export
- **Import:** .ppt/.pptx/.key/.pdf → converted to static images (no animations); Google Slides only via download-as-pptx/pdf. 60 MB file max, 100-slide cap. Requires Basic+. Pro+ can *embed* live PowerPoint/Google Slides (animations preserved).
- **Export:** results to Excel (Basic+), PDF of deck+results (text-based PDFs replaced image screenshots Apr 2026), per-widget result screenshots (May 2026). No native .pptx deck export.

## 5. Join flow
Browser-based, no app: menti.com + numeric join code (8 digits, temporary; codes expire ~2 days after last use [unverified exact window]), QR code, or direct link. Works on phone/tablet/computer; latency is near-real-time (WebSocket via Ably). For large venues Mentimeter advises mobile data over shared WiFi.

## 6. UX/UI sentiment
- **Ratings:** G2 4.7/5 (~634+ reviews), Capterra 4.4/5, Trustpilot ~2.7/5 (billing/support complaints cluster there).
- **Praise:** extremely easy to use, polished design, anonymity drives honest participation, real-time word clouds, good templates.
- **Complaints:** stingy free tier ("useless tool if you don't pay"), annual-only billing, 14-day refund window with denied refunds, slow support, slides import as static images, embedded videos glitchy, PowerPoint add-in "tricky to set up and doesn't always work", question variety weaker for assessment than Wooclap/Poll Everywhere.

## 7. Reliability at scale
Realtime layer runs on Ably (five-nines SLA) after a prior provider crashed at ~35k concurrent connections; now scales 0→70,000+ concurrent in seconds, targeting 150,000. Quiz type remains the weak point (2,000 cap). No offline mode — fully internet-dependent. No major 2025-26 outage widely reported [unverified].

## 8. Integrations & API
PowerPoint add-in (V3 default since late 2024; auto titles/alt-text May 2026), MS Teams app, Zoom app, Webex, Hopin, Canva, Miro. **LMS LTI integrations (Canvas, Moodle, Blackboard, D2L Brightspace) shipped Mar 2026** — previously a major gap. Public developer API exists (developer.mentimeter.com) but is limited/partner-oriented; no Zapier integration (still an open feature request) [unverified scope].

## 9. Strengths / weaknesses / 2025-26 developments
- **Strengths:** best-in-class ease of use and visual polish; no participant app; strong scale infrastructure; now bundled AI at all tiers; new LMS support.
- **Weaknesses:** expensive per-presenter annual-only pricing; 50/month free cap with lockout; quiz 2,000-participant ceiling; static-image imports below Pro; weak API/automation; Trustpilot-visible billing/support friction.
- **Recent:** Menti AI suite (Jan-Feb 2026), LMS LTIs (Mar 2026), Mentimote 2.0 + text PDF export + accessibility font (Apr 2026), brand refresh + verified participants (2025), Desktop app discontinued (summer 2025).