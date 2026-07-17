# PulseDeck Live — AppSource Submission Package

> **PROGRESS (July 11, 2026):** Enrollment DONE — Ruavira Collective Inc. is enrolled in the
> Microsoft 365 and Copilot program (work account `AyodejiSamuels@RuaviraCollectiveInc.onmicrosoft.com`;
> publisher verification: Pending, registration number 1715994-3 submitted). Offer draft
> **"PulseDeck Live"** created (offer ID 35d4be62-a75b-4b0c-b0a7-e0b140e4bacf). Completed in
> Partner Center: Product setup ✅, Properties (categories + legal URLs) ✅, Availability
> (all markets) ✅, English listing text (name/summary/description/keywords) ✅.
> Remaining (drag-and-drop by Ayodeji): manifest.xml → Packages; store-logo-300.png (icon) +
> 5 screenshots → Marketplace listings; certification-notes PDF → Additional certification info.
> Then "Review and publish" once publisher verification clears.


Everything below is prepared and live. The only steps that require you personally are
creating the Partner Center account and filling the submission form (this file gives you
every value to paste).

---

## 1. What's already done ✅

| Item | Where |
|---|---|
| Add-in manifest (validated ✅ by Microsoft's acceptance test) | `https://pulsedeck-live.netlify.app/addin/manifest.xml` (source: `public/addin/manifest.xml`, v1.1.0.0) |
| Privacy policy (required) | `https://pulsedeck-live.netlify.app/privacy` |
| Terms of use (required for the EULA field) | `https://pulsedeck-live.netlify.app/terms` |
| Support page (required, linked as SupportUrl in manifest) | `https://pulsedeck-live.netlify.app/support` |
| Manifest icons 16/32/64/80/128px | `https://pulsedeck-live.netlify.app/addin/icons/icon-{size}.png` |
| Store logo 300×300 (upload in Partner Center) | `docs/appsource/store-logo-300.png` → also at `/addin/icons/store-logo-300.png` |
| Screenshots 1366×768 (upload in Partner Center) | `docs/appsource/shot-1-landing.png` … `shot-5-addin-live.png` |
| Dedicated validation session (never end this one) | Code **MY6ZG5** |
| Add-in empty/error states | Polished: product explanation, studio link, support link, friendly errors |

**Validation session details** (goes in the "Notes for certification" box):

- Join page: `https://pulsedeck-live.netlify.app/j/MY6ZG5`
- Stage link (paste into the add-in):
  `https://pulsedeck-live.netlify.app/present/4d443950-216a-4349-99bb-58d7033f521f?key=<YOUR-PRESENTER-KEY>`

---

## 2. Your steps

### Step A — Create the Partner Center account (one-time, free)

1. Go to <https://partner.microsoft.com/dashboard/registration> and sign in with the
   Microsoft account you want to own the listing.
2. Enroll in the **Microsoft Marketplace** (commercial marketplace) program. No fee.
3. Publisher profile: legal name **Ruavira Collective Inc.**, your address, and a contact
   email. Publisher verification may take a few days — everything else can be prepared
   while you wait.

### Step B — Create the offer

Partner Center → **Marketplace offers** → **+ New offer** → **Office add-in**.

1. **Offer ID / alias:** `pulsedeck-live`
2. **Product setup → Manifest:** provide the manifest URL
   `https://pulsedeck-live.netlify.app/addin/manifest.xml` (or upload the file).
3. **Properties:** Category **Productivity** (secondary: Education). Legal:
   - Privacy policy URL: `https://pulsedeck-live.netlify.app/privacy`
   - EULA: use your own terms → `https://pulsedeck-live.netlify.app/terms`
4. **Marketplace listing:** paste the copy from §3 below, upload the 300×300 logo and the
   five screenshots from `docs/appsource/`.
5. **Availability:** all markets (default), free.
6. **Notes for certification:** paste §4 below verbatim.
7. **Review and publish.**

### Step C — After submission

- Typical first review: 3–10 business days. Rejections come with specific policy numbers
  and are normal on a first pass — send them to me and I'll fix and you resubmit.
- Once live: the add-in appears in PowerPoint → **Home → Add-ins** search on Windows, Mac,
  and web. Panel updates deploy instantly with the site; only manifest changes need
  re-review.

---

## 3. Listing copy (paste-ready)

**Name:** PulseDeck Live

**Summary (≤100 chars):**
`Live polls, quizzes, word clouds and Q&A inside your slides — audiences join with one QR code.`

**Description:**

> PulseDeck Live puts your interactive presentation stage inside PowerPoint. Run live
> polls, word clouds, competitive quizzes with a live leaderboard, rating scales, and audience
> Q&A — and watch results land on your slide in real time.
>
> **Your audience needs nothing.** They scan one QR code (or type a 6-letter code at
> pulsedeck-live.netlify.app), and they're voting from their phone browser in seconds. No
> app, no account, no sign-up — for them or for you.
>
> **How it works:**
> 1. Build your interactive deck free at pulsedeck-live.netlify.app/studio — or import
>    your existing PowerPoint, PDF, or Markdown, or generate a deck with AI.
> 2. Press Present and copy the stage link.
> 3. Insert this add-in on a slide and paste the link once. Your live stage — results,
>    join QR, leaderboard — renders right inside your deck, and you drive everything from
>    your phone.
>
> **Built for real rooms:** server-scored quizzes nobody can cheat, always-on profanity
> filtering, optional Q&A moderation, and a realtime architecture certified for 1,000
> simultaneous participants. When you're done, everything exports — results to Excel/CSV,
> slides back to PowerPoint. Your data is never locked in.

**Search keywords:** live polls, quiz, audience engagement, Q&A, word cloud, interactive
presentation, audience response, leaderboard

**Screenshot captions (in order):**
1. Your audience joins with one code — no app, no account.
2. Live poll results land on the big screen in real time.
3. Build slides, polls, quizzes and Q&A in the free studio.
4. Insert the add-in and paste your stage link once.
5. Your live stage — bars, leaderboard, Q&A — inside PowerPoint.

---

## 4. Notes for certification (paste verbatim)

> PulseDeck Live is a content add-in that displays the presenter's live PulseDeck stage
> inside a slide. No account or sign-in is required at any point.
>
> **To test:**
> 1. Insert the add-in. On the setup screen, paste this stage link and press "Show live
>    stage":
>    https://pulsedeck-live.netlify.app/present/4d443950-216a-4349-99bb-58d7033f521f?key=<YOUR-PRESENTER-KEY>
> 2. The live session (code MY6ZG5) renders inside the slide: slides, a join QR code, live
>    poll results, quiz leaderboard and Q&A wall.
> 3. To test audience interaction, open https://pulsedeck-live.netlify.app/j/MY6ZG5 in any
>    browser (e.g., on a phone) — no account needed — and submit a response; it appears in
>    the add-in pane in real time.
> 4. "Change session" (top right of the pane) returns to the setup screen.
>
> The add-in communicates only with pulsedeck-live.netlify.app. It reads nothing from the
> user's document and stores only the pasted stage link, locally.

---

## 5. Asset inventory

```
docs/appsource/
├── shot-1-landing.png      1366×768  (join-first landing page)
├── shot-2-stage.png        1366×768  (live poll results on stage)
├── shot-3-studio.png       1366×768  (deck editor)
├── shot-4-addin.png        1366×768  (add-in setup screen)
├── shot-5-addin-live.png   1366×768  (live stage inside the add-in)
└── store-logo-300.png      300×300   (Partner Center logo)

public/addin/icons/         icon-16/32/64/80/128.png + store-logo-300.png (served publicly)
```

Add-in ID (manifest GUID): `0a1fe517-e317-411a-8cba-21683762b87b` — keep this stable
forever; it is the add-in's identity across updates.
