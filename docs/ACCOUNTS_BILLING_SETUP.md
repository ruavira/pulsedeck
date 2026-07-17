# PulseDeck Accounts + Billing — Setup Runbook

Presenter accounts (Supabase Auth) + freemium billing (Stripe). Audience stays
100% anonymous — this only touches the presenter/professional side.

Plan: **Free** (3 decks, ≤50 participants, no AI/exports) vs **Pro**
($12/mo or $120/yr — unlimited decks, 1,000 participants, AI, video upload, exports).

Code is built and env-gated: with nothing configured the app runs fine and
billing routes return 501. It lights up as each credential below is set.

---

## What's DONE (code, verified locally)
- Supabase schema: `profiles`, `subscriptions`, `decks.owner_id`, signup trigger, RLS.
- Auth: `/login`, `/signup` (email+password, Google button, magic link), `/auth/callback`, session `proxy.ts`.
- Studio gated behind login; `/studio/[id]?key=…` stays open (add-in, deep links, live shows unaffected).
- Decks stamped with `owner_id`; library syncs across devices via `/api/account/decks`.
- `/pricing` (monthly/annual toggle) + `/account` (plan, manage billing, sign out).
- Stripe routes: `/api/billing/checkout`, `/api/billing/webhook`, `/api/billing/portal`.
- Free-tier gating enforced server-side: deck limit + AI Pro-only.

## STATUS: LIVE ✅ (deployed + tested in production, July 11 2026)
Accounts + freemium billing are live at https://pulsedeck-live.netlify.app.
End-to-end test passed: signup → free profile auto-created → Stripe test
subscription → **webhook flipped account to Pro** → customer linked. Core
audience certification still 37/37.

### 1. Supabase Auth config — DONE ✅
- Site URL: `https://pulsedeck-live.netlify.app`
- Redirect URLs: `https://pulsedeck-live.netlify.app/**` + `http://localhost:3000/**`
- Email provider enabled; **Confirm email OFF** (instant beta signups).

### 2. Stripe — DONE ✅ (Ruavira Collective Inc. account, TEST MODE)
- Product `prod_Uruw0uI290Tsts` "PulseDeck Pro".
- Prices: monthly `price_1TsB6RHl4OQtYkg2HBxti98E` ($12), annual `price_1TsB6RHl4OQtYkg2n8CHOQEo` ($120).
- Webhook `we_1TsB6SHl4OQtYkg2cFblnd6o` → `…/api/billing/webhook`.
- All four env vars set in Netlify + local `.env.production`.

### 3. Google sign-in (optional — email works without it; NOT yet configured)
- console.cloud.google.com → OAuth consent screen (External; app "PulseDeck";
  support email support@ruavira.org).
- Credentials → Create OAuth client ID → Web application → Authorized redirect URI:
  `https://jykgeyomiqtrvbfstmmh.supabase.co/auth/v1/callback`
- Copy Client ID + Secret into Supabase → Authentication → Providers → **Google**.

---

## Env vars (set in Netlify + local `.env.production`)
```
STRIPE_SECRET_KEY=sk_test_…        # then sk_live_… at go-live
STRIPE_PRICE_MONTHLY=price_…
STRIPE_PRICE_YEARLY=price_…
STRIPE_WEBHOOK_SECRET=whsec_…
```
(Supabase URL + anon key are already baked into config.ts.)

## Go-live (after test-mode is proven)
Swap the Stripe test key/prices/webhook for live-mode equivalents, redeploy.
Optionally flip the marketing line on the AppSource listing ("no account for you"
→ presenters now have accounts; the add-in + audience stay accountless, so the
certification claim is unchanged).

## Known fast-follow
- Free-tier **participant cap (50)** is advertised but not yet hard-enforced at
  join time (needs a check in the `join_session` RPC against the deck owner's
  plan). Deck limit + AI gating ARE enforced. Low risk for a small beta.
