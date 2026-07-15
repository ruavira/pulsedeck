# Partner Center Registration — RCI Prep Sheet

Everything to have on screen when you open
**https://partner.microsoft.com/dashboard/registration**.
Fill order matches the enrollment flow. Values marked ⚠️ need something only you have.

---

## 1. Company identity (verified against Corporations Canada)

| Field | Value |
|---|---|
| Legal business name | **Ruavira Collective Inc.** (exact spelling — matches CBCA registry) |
| Incorporation | Federal (CBCA), Corporation **#1715994-3** |
| CRA Business Number | **747539161** |
| Country | Canada |
| Province | Alberta |
| City | Calgary |
| Street address | **419-26 Val Gardena View SW** |
| City / Province | Calgary, Alberta |
| Postal code | **T3H 5Z5** |
| (Reminder) | This should match the registered-office address on the CBCA filing for corp #1715994-3 — that's what publisher verification cross-checks. |
| Website | https://ruavira.org |

## 2. Primary contact / account owner

| Field | Value |
|---|---|
| Name | Ayodeji Samuels |
| Title | Founder & CEO |
| Email | **ayodejis@ruavira.org** (account owner — a person, not a shared box) |
| Phone | +1 (782) 830-5779 |

Use **ayodejis@ruavira.org** as the primary contact / account owner and keep
**support@ruavira.org** as the customer-facing support contact (§5) — Partner Center
notices and verification codes then reach you personally, while AppSource shows the
shared support address to the public. Microsoft sends a **verification code to the
primary email** during enrollment — have the Namecheap webmail open in another tab.

## 3. The work account you'll create mid-flow

When sign-in asks for a work account and you have none, choose **create a new work
account**. Suggested values (permanent — pick carefully):

| Field | Suggested value |
|---|---|
| Tenant / domain name | `ruaviracollective` → becomes **ruaviracollective.onmicrosoft.com** |
| Username | `ayodejis@ruaviracollective.onmicrosoft.com` (matches your ruavira.org handle; after domain verification, sign-in becomes `ayodejis@ruavira.org`) |
| Password | Your choice — store it in your password manager immediately; this account owns the AppSource listing |

After enrollment I'll drive adding **ruavira.org** as a verified custom domain (one TXT
record in Namecheap DNS), so sign-in becomes `ayodejis@ruavira.org`.

## 4. Payment card

A card is requested for identity confirmation only — **nothing is charged**. Any card in
your name or the company's works.

## 5. Publisher profile (after enrollment, before the offer)

| Field | Value |
|---|---|
| Publisher display name | **Ruavira Collective** (what AppSource shows publicly; "Inc." optional) |
| Publisher website | https://ruavira.org |
| Support contact | support@ruavira.org |

## 6. Documents to have handy (only if verification asks)

- CBCA Certificate of Incorporation / articles for corporation #1715994-3
  (download from Corporations Canada if you don't have the PDF)
- A recent document showing the business name + registered address (bank statement,
  CRA correspondence, or the registry profile printout)

Verification is often automatic against the registry; documents are the fallback if it
can't match. Typical clearing time: 1–5 business days.

## 7. What happens next (already prepared)

Once verification clears, the offer itself is a form-fill from
**APPSOURCE_SUBMISSION.md** (in the project docs and `docs/`): manifest URL, listing
copy, keywords, five screenshots, 300×300 logo, and verbatim certification notes with
the standing validation session (code MY6ZG5).

Consistency notes (already handled):
- PulseDeck's /privacy, /terms and /support pages now list **support@ruavira.org** as the
  contact — same email you'll give Microsoft, same domain as the publisher website.
- The add-in manifest's ProviderName is **Ruavira Collective Inc.** — matches the legal
  name above.
