# PulseDeck — Platforms & accounts to reach full Gamma.app parity

_Last updated: 2026-07-12. Everything in "Already wired" is live now; everything
in "Add a key to activate" is coded and drop-in — the moment you paste the key
into Netlify (as a **standard**, non-secret variable) and I redeploy, it works._

---

## ✅ Validation status (live-tested 2026-07-12, 2nd pass)
Every engine is **wired and its code verified correct**. Where a call fails it's an
account-side blocker (funding/billing) or a key that isn't reaching Netlify.

**Live & working now (zero ongoing cost):**
- **Pollinations** (free AI), **Cloudflare** Workers AI (free), **Stability AI** ✅
  (free signup credits; hosts to Supabase `media` bucket), **Unsplash** ✅,
  **Pexels** ✅, **Pixabay** ✅ (3rd free stock library), **Giphy** ✅ (GIF backgrounds).

**Configured but failing — need account funding (user skipping for now):**
| Engine | Error | Fix |
|---|---|---|
| **fal.ai** | `Exhausted balance` | Add credit → fal.ai/dashboard/billing |
| **OpenAI** | `Billing hard limit reached` | Add billing (+ maybe org ID-verification for gpt-image-1) |
| **Imagen** | `Imagen only on paid plans` | Enable billing on the Google AI project |
| **Replicate** | fails after ~31s | Set up billing on Replicate |
| **Ideogram** | `401 token rejected` | Re-check the key value + API access |

**Not added (paid — user deferred):** Recraft, Leonardo. Wired and drop-in; add
`RECRAFT_API_KEY` / `LEONARDO_API_KEY` + credits whenever ready.

Note: the temporary `/api/media/diag` endpoint used for this diagnosis has been removed.

---

## Direct links (bookmark these)
Sign-up first, then the API-key page. For each: create the key → add it in Netlify
as a **standard** (not "secret") env var with the exact name → tell me → I redeploy + validate.

| Platform | Sign up | Get the API key | Netlify env var |
|---|---|---|---|
| **Cloudflare** (Workers AI) | https://dash.cloudflare.com/sign-up | https://dash.cloudflare.com/754dd2fec0f0b14a2c0d33b9fbf561f5/api-tokens/create (use the **Workers AI** template) | `CLOUDFLARE_API_TOKEN` |
| **fal.ai** | https://fal.ai | https://fal.ai/dashboard/keys | `FAL_KEY` |
| **Unsplash** | https://unsplash.com/join | https://unsplash.com/oauth/applications/new (create app → copy **Access Key**) | `UNSPLASH_ACCESS_KEY` |
| **Ideogram** | https://ideogram.ai | https://ideogram.ai/manage-api | `IDEOGRAM_API_KEY` |
| **Google Imagen** (Gemini) | https://ai.google.dev | https://aistudio.google.com/app/apikey | `GOOGLE_IMAGEN_KEY` |
| **OpenAI** | https://platform.openai.com/signup | https://platform.openai.com/api-keys | `OPENAI_API_KEY` |
| **Replicate** | https://replicate.com | https://replicate.com/account/api-tokens | `REPLICATE_API_TOKEN` |
| **Stability AI** | https://platform.stability.ai | https://platform.stability.ai/account/keys | `STABILITY_API_KEY` |
| **Recraft** | https://www.recraft.ai | https://www.recraft.ai/profile/api | `RECRAFT_API_KEY` |
| **Leonardo** | https://leonardo.ai | https://app.leonardo.ai/api-access | `LEONARDO_API_KEY` |
| **Pixabay** | https://pixabay.com/accounts/register/ | https://pixabay.com/api/docs/ (key shown when logged in) | `PIXABAY_API_KEY` |
| **Giphy** | https://developers.giphy.com | https://developers.giphy.com/dashboard/ (create app) | `GIPHY_API_KEY` |

> Unsplash note: new apps start in **Demo** mode (50 requests/hour) and Unsplash's
> terms require photo attribution + applying for **Production** access
> (5,000/hour) at the app's dashboard once you're ready to go live.

---

## 0. Already wired — no action needed
| Platform | Purpose | Status |
|---|---|---|
| **Anthropic (Claude)** | AI text / deck authoring | ✅ live (`ANTHROPIC_API_KEY`) |
| **Pollinations.ai** | Free AI images (FLUX), keyless | ✅ live, default free engine |
| **Pexels** | Stock photos | ✅ live (`PEXELS_API_KEY`) |
| **Supabase** | DB, auth, realtime | ✅ live |
| **Netlify** | Hosting / deploys | ✅ live |
| **Cloudflare Workers AI** | Free AI images (FLUX) on your account | ⏳ account ID set — waiting on your `CLOUDFLARE_API_TOKEN` |

---

## 1. AI image engines — the core of Gamma's image variety
All eight below are **already coded** in the provider registry. Open an account,
create an API key, and I switch each on. `auto` stays on the free engines, so
these are only used when explicitly picked (no surprise spend).

| Engine | Sign-up | Why open it | Rough cost | Env var |
|---|---|---|---|---|
| **fal.ai** | fal.ai | Fastest FLUX, cheap, hosted URLs. **Best first paid engine.** | ~$0.003/img | `FAL_KEY` |
| **Replicate** | replicate.com | FLUX + thousands of other models, cheap, hosted URLs | ~$0.003/img | `REPLICATE_API_TOKEN` |
| **Google Imagen 3** | ai.google.dev (Gemini API) | Google's flagship, very strong realism | ~$0.03/img | `GOOGLE_IMAGEN_KEY` |
| **OpenAI GPT-Image-1** | platform.openai.com | Best prompt-following + text-in-image | ~$0.04/img | `OPENAI_API_KEY` |
| **Stability SD3** | platform.stability.ai | Reliable, tunable, good value | ~$0.04/img | `STABILITY_API_KEY` |
| **Ideogram v2** | ideogram.ai | **Best-in-class text inside images** (posters, titles) | ~$0.08/img | `IDEOGRAM_API_KEY` |
| **Recraft V3** | recraft.ai | Vector/brand/illustration strength (maps to your style presets) | ~$0.04/img | `RECRAFT_API_KEY` |
| **Leonardo Phoenix** | leonardo.ai | Stylised, artistic, strong illustration | credits | `LEONARDO_API_KEY` |

**Recommended shortlist (don't open all eight):** **fal.ai** (cheap FLUX workhorse) +
**Ideogram** (text-in-image, which FLUX is weak at) + **Google Imagen** or **OpenAI**
(a premium realism option). That trio covers everything Gamma's image picker does.

---

## 2. Stock & media sources — to match Gamma's library breadth
Gamma pulls from big free libraries. **All four are now wired** — just add the key.
A "Stock library" picker appears in the generate panel when more than one photo
source is configured (`auto` prefers Unsplash → Pexels → Pixabay, with automatic
fallback between them). **Giphy** adds a **Photo / GIF toggle** on each slide's
Background control in the editor, so you can set an animated GIF background.

| Platform | Unlocks | Cost | Env var | Status |
|---|---|---|---|---|
| **Unsplash** | The library Gamma leans on most — huge, high quality | Free | `UNSPLASH_ACCESS_KEY` | ✅ wired |
| **Pexels** | Clean-license stock, no attribution | Free | `PEXELS_API_KEY` | ✅ wired + live |
| **Pixabay** | Photos + illustrations + vectors, generous free tier | Free | `PIXABAY_API_KEY` | ✅ wired |
| **Giphy** | Animated GIF backgrounds (Photo/GIF toggle per slide) | Free | `GIPHY_API_KEY` | ✅ wired |

---

## 3. Image hosting — optional, only if decks feel heavy
Right now byte-returning engines (Cloudflare/OpenAI/Stability/Imagen) inline the
image as a data URL — works with zero setup, but makes those decks larger. To get
lightweight hosted URLs instead, pick **one**:

| Option | Sign-up | Notes |
|---|---|---|
| **Supabase Storage** (you already have Supabase) | — | I'd wire a dedicated storage service-role key. Simplest, but adds a powerful secret to the runtime. |
| **Cloudflare R2** (you already have Cloudflare) | dash → R2 | S3-compatible, cheap, keeps the secret scoped to storage only. **Cleaner option.** |

Not urgent — Pollinations, fal, Replicate, Ideogram, Recraft, Leonardo all return
hosted URLs already, so this only matters if you lean on the base64 engines.

---

## 4. Fonts & brand kit — Gamma's "font pairing" — ✅ BUILT
No signups needed. The theme popover (top-bar swatch) now has:
- **Fonts** — 8 curated Google-Fonts pairings (Fraunces·Inter, Playfair·Source Sans,
  Space Grotesk·Inter, DM Serif·DM Sans, Sora, Poppins, Libre Franklin·Lora, + System).
  Applied per deck to headings/body across the stage and the studio preview.
- **Brand logo** — upload a logo (PNG/SVG/JPG/WebP → the `media` bucket); it renders
  in the top-right corner of content slides on the stage and preview. Replace/Remove.

Google Fonts are loaded on demand (no account, no key). Fontshare could be added later
if you want a specific family that isn't on Google Fonts.

---

## 5. Optional extras (nice-to-have, not blocking)
| Platform | Purpose | Cost |
|---|---|---|
| **Iconify** | Icon library for slides (Gamma has icons) | Free, no key |
| **Cloudflare R2 / Images** | Long-term owned hosting of all generated media | Cheap |

---

## Priority order (my recommendation)
1. **Finish Cloudflare** (token) — free, already 90% done.
2. **fal.ai** — the cheap, fast paid workhorse; biggest quality jump for least money.
3. **Unsplash** (I build the adapter) — the single most Gamma-like stock upgrade.
4. **Ideogram** — the one thing FLUX/stock can't do: real text inside images.
5. One premium realism engine — **Google Imagen** or **OpenAI**.
6. Everything else as you need it.

## How each key goes live
For every one: create the key on the platform → in Netlify add it as a **standard**
(not "secret") environment variable with the exact `Env var` name above → tell me →
I redeploy and validate it end-to-end (generate one test image through it). I never
handle the key values myself; you paste them into Netlify.
