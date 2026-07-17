# Kahoot! — Audience Interaction Platform Research (July 2026)

## 1. Feature inventory
- **Test-knowledge types**: Quiz/multiple-choice (free; 2–6 answers, 120-char Q, 75-char answers, 5s–4min timer, 0/1000/2000 pts), True/False (free), Type Answer (paid, 20-char), Puzzle/ordering (paid, 3–4 items), Slider (paid, numeric estimate with margin settings), Pin Answer on image (paid).
- **Opinion types (all paid)**: Poll, Word Cloud (20 chars/response), Open-Ended (250 chars), Brainstorm (5 ideas x 75 chars, AI-groups submissions, voting phase), Drop Pin, Scale (Likert 1–5 or 0–10), NPS Scale (auto Detractor/Passive/Promoter buckets).
- **Q&A** (2025 feature): "Ask" button, 200-char questions, upvoting, Latest/Top-Voted sort, anonymous via nickname generator; **Moderated Q&A** (Professional hosting mode / 360 Pro Plus+) with In Review/Approved/Dismissed/Archived queues.
- **Content slides**: static slides (paid) interleaved with questions; max 200 questions/kahoot.
- **Hosting "experiences"**: Classic (speed-scored, characters/music), Accuracy (Aug 2025 — correctness-only scoring, optional unlimited answer time), Confidence (Dec 2025 — low-pressure), Lecture, Presentation (professional look, lobby music). Character-avatar toggle default-off for business/higher-ed (2026).
- **Branding**: "Immersive branding" on top tiers — 112 custom fonts, color palettes, custom lobby music, logo; locked templates otherwise.

## 2. Pricing & limits (2025–26; annual billing)
- **Free (Kahoot! Go)**: 10 players personal/higher-ed, 40 for K-12 teachers; MCQ + True/False only; unlimited sessions.
- **Personal Kahoot!+**: Bronze $36/yr (50 players), Silver ~$156/yr (100), Gold ~$180/yr (200, AccessPass content + AI); Kahoot! One ~$300/yr (800); One Max (2,000); One Ultra (4,000).
- **EDU**: EDU Standard $15/teacher/mo, min 3 licenses (800 live); EDU Pro $25/teacher/mo (2,000 live / 10,000 assignments).
- **Business (Kahoot! 360 Pro)**: Start $228/yr (50), Standard $300/yr (200; unlocks type answer/slider/pin/brainstorm/word cloud/Q&A/slide sync), Plus $588/yr (1,000; NPS, moderated Q&A, custom theming, courses), Max $828/yr (2,000; immersive branding, commercial rights), Ultra $948/yr (5,000; 50-seat collaboration, event consultation). Teams: 360 Spirit ~$6,000/yr/25 seats (400 players), Spirit Premium ~$7,500/yr (2,000). One-time **Event plans $199–$799** (200–5,000 players). [pricing figures vary slightly by source/region]
- Hard cap: **5,000 concurrent players** max on any plan (10,000 only for async EDU assignments).

## 3. AI features
Kahoot generator from topic/PDF/URL/Wikipedia (difficulty + tone control), per-question generation (OpenAI GPT-4-based), question generation from synced PowerPoint/Google Slides, AI image generation (web only). PDF-to-kahoot page limits: 150 pages (Standard/Plus), 500 (Ultra). May 2026: multilingual generation (70 languages) + auto-alignment to all 50 US state standards/CCSS/NGSS. Quality verdict from reviewers: "serviceable for low-stakes review" but surface-level, needs heavy editing; Kahoot itself warns of inaccuracy.

## 4. Import/export
- **Import**: slides from .pptx/.ppt/.key/.pdf (Google Slides via PDF export or native Slide Sync); converted slides — audio/video/animations NOT preserved; 80MB file cap; web-only. Spreadsheet question importer (Excel template). Slide Sync keeps PowerPoint/Google Slides updated in kahoot.
- **Export**: results as .xlsx spreadsheet reports (per-player, per-question) or save to Google Drive; business "story reports" on Plus+. **No deck export, no SCORM/xAPI output** — content locked in platform.

## 5. Join flow
Browser join at kahoot.it with 6–7 digit game PIN, or QR code from lobby; no app required (iOS/Android apps optional); 2-step Join option (PIN + on-screen pattern) to block bot flooding; 2026 update lets hosts start without waiting for joins. Latency generally low but users report lag on weak connections [anecdotal, unverified quantitatively].

## 6. UX sentiment
G2 4.6/5 (~405 reviews). **Praise**: unmatched live energy/engagement, near-zero learning curve (quiz in <10 min), music/leaderboards, huge community library. **Complaints**: aggressive paywalling ("limited free features" is top complaint — free tier cut to 10 players and MCQ-only), subscription cost creep ($600–$1,440 over 3 years), "colorful and cluttered" UI, lag/autosave issues, gimmicky for adult audiences, weak async mode, no adaptive/branching logic.

## 7. Reliability at scale
Plan-gated caps (50→5,000). Public status page (status.kahoot.com). Known failure modes: bot/flooding attacks ("Kahoot smashers" — mitigated by 2-step join), speed-based scoring penalizes slow networks, connectivity guidance doc exists because weak Wi-Fi visibly degrades games. **No offline mode**; host and all players need live internet. Large-event consultation bundled only with Ultra/Event plans.

## 8. Integrations & API
PowerPoint add-in (host live kahoots inside PPT), Microsoft Teams app, Zoom app, Hopin; LMS via **LTI 1.3 Advantage** (Canvas, Moodle, Blackboard, Schoology, Brightspace; June 2024+); Microsoft 365/Google SSO. **No public REST API** for developers [unverified — none documented]; only ~4 native business integrations per comparisons.

## 9. Strengths / weaknesses / 2025-26 developments
**Strengths**: category-defining game energy, trivially easy hosting, no participant app, big content library, strong EDU standards alignment, one-time event pricing. **Weaknesses**: quiz-first (weaker for polls/Q&A vs Slido/Mentimeter), most non-quiz types paywalled, fragmented confusing SKU lineup, no SCORM/API/deck export, 5,000-player ceiling. **Recent**: Accuracy & Confidence hosting modes (2025), Q&A with moderation, 15s timer + bulk timer edit, clipboard image paste, gift cards (Nov 2025), curriculum-aligned multilingual AI (May 2026), immersive branding expansion.

Sources: support.kahoot.com (participant limits, question types, AI tools, slide import, Q&A, feature changelog), kahoot360.com/pricing, wooclap.com/en/blog/kahoot-pricing & kahoot-vs-mentimeter, atomisystems.com Kahoot Review 2026, g2.com/products/kahoot/reviews, kahoot.com (LTI blog, integrations, ai-tools), status.kahoot.com.