# Carrier onboarding and the admin area

Date: 2026-11-10. Follows `2026-11-04-carrier-console-design.md` ("What comes next").

## Why

The carrier console works, but the only carrier account is a seeded demo. A real
carrier has no way to appear on Cargoa. The marketplace needs a way for a
company to apply, prove it is real, be approved by the owner, and get into the
console. Nothing in this feature may cost money to build or to run.

## Goals

1. Registration starts with a choice between two cards: **Customer** and
   **Carrier**. Customer leads to the existing form; Carrier leads to an
   application.
2. A carrier application: one form for every country, with two PDF documents.
3. Email confirmation, then an admin approval queue with approve / reject.
4. After approval the carrier sets a password and lands in the console.
5. An admin area with the queue and an **Outbox** that shows every email the
   site "sent", so the whole path works without a mail domain.
6. Every paid or external piece sits behind a small interface with a free
   default, and the docs say exactly how to switch each one on.

## Not in this design

- Sign-in with an authenticator app code (2FA). Planned later; `otplib`.
- More than one manager per carrier, or inviting colleagues.
- Editing a carrier's profile after approval.
- Re-applying by editing a rejected application (a rejected company applies again).
- Payment, notifications to clients.

## The path of an application

```
form submitted ──► EMAIL_PENDING ──(link from email)──► PENDING_REVIEW
                        │                                  │        │
                  48 h without                          approve   reject
                  confirming                               │        │
                        ▼                                  ▼        ▼
                     (deleted)                         APPROVED  REJECTED
                                                           │
                                             (link from email: set password)
                                                           ▼
                                               manager account created
```

1. **Submit.** The form and two PDFs arrive in one request. The server stores
   the application as `EMAIL_PENDING` and writes a confirmation email.
2. **Confirm email.** The link carries a one-time token. Opening it moves the
   application to `PENDING_REVIEW` and starts the registry check (below).
3. **Review.** The admin sees the data, the registry result and the two files,
   then approves, or rejects with a written reason. Both write an email.
4. **Approve** creates the carrier and a "set your password" token (7 days).
   No user exists yet: the `users` table requires a password hash, and an
   account nobody can sign in to is a liability.
5. **Set password.** The link opens a page with one password field. Submitting
   creates the `MANAGER` user bound to the new carrier, signs them in, and
   sends them to `/console`.

The applicant never chooses a password on the application form. A password is
set once, after approval, by whoever controls the confirmed mailbox.

## The application form

One form for all countries. Required unless marked optional.

| Field | Notes |
| --- | --- |
| Legal company name | 2–200 characters |
| Trading name | optional; what clients see. Defaults to the legal name |
| Country | from the country profiles below |
| Address | one multi-line field, 5–500 characters |
| Company registration number | label and format depend on the country |
| Tax / VAT number | optional |
| Transport licence number | optional; label depends on the country |
| Contact person | 2–100 characters |
| Work email | becomes the manager's sign-in email |
| Phone | digits, spaces, `+ ( ) -`; 7–20 digits |
| Transport types | at least one of `TRUCK`, `RAIL`, `AIR`, `SEA`, `LTL` |
| Cargo categories | `GENERAL` always on; the special ones are opt-in |
| Certificate of registration | PDF, up to 5 MB |
| Insurance certificate | PDF, up to 5 MB |

Cargo categories are asked because a carrier record needs
`acceptedCargoCategories`, and a carrier that is not certified for dangerous
goods must not appear in a dangerous-goods search.

### Country profiles

Each country is one entry of configuration, not code:

```ts
{ code: "US", name: "United States",
  registration: { label: "EIN", hint: "9 digits, like 12-3456789", pattern: /^\d{2}-?\d{7}$/ },
  licence: { label: "USDOT / MC number" },
  registry: "FMCSA" }
```

First set: `US` (EIN; USDOT/MC; FMCSA), `IL` (company number ח.פ. shown in
English as "Company number (H.P.)", 9 digits; manual), `RU` (INN / OGRN, 10 or
13 digits; manual), the EU member states (VAT number; VIES), and `OTHER`
(free-text number, 3–40 characters; manual). The frontend reads the profiles
from `GET /api/onboarding/countries` so labels and hints never drift from the
server's validation. Adding a country is adding one entry.

## Checks

### Registry check

Runs once, when the email is confirmed. It never blocks or rejects by itself;
it only gives the admin a hint, stored on the application:

| Result | Meaning |
| --- | --- |
| `FOUND` | the registry knows this number; the registry's company name is stored next to it |
| `NOT_FOUND` | the registry answered and does not know it |
| `UNAVAILABLE` | the registry did not answer in 5 s, or no key is configured |
| `MANUAL` | this country has no automatic registry |

- **FMCSA** (US): free QCMobile API, needs a free key in `FMCSA_WEB_KEY`. Looks
  up the USDOT / MC number, so it runs only when the licence number is given.
- **VIES** (EU): free, no key. Looks up the VAT number.

The admin can press "Check again" on an `UNAVAILABLE` result.

### Bot protection

The form carries a **Cloudflare Turnstile** token, verified by the server with
`TURNSTILE_SECRET`. When the secret is not set the check is skipped and a
warning is logged once at start, so local work and a first launch need no
setup. Cloudflare's published test keys are used in development and tests.

### Rate limit and abuse

- The submit route gets its own limit: 5 per hour per IP.
- Files are checked by content, not by name: the first bytes must be `%PDF-`.
- The answer to "submit" is always the same ("check your mailbox"), whether or
  not the email already has an account or an application, so the form cannot be
  used to learn who is registered. An email that already has an account gets a
  "you already have an account" email instead of a confirmation link.
- Tokens are 32 random bytes; only their SHA-256 hash is stored. A token works
  once. Confirmation tokens live 48 hours, set-password tokens 7 days.

## The three "sockets"

Each is an interface with a free implementation used now and a real one
switched on by environment variables, with no code change.

| Socket | Free now | Later | Switch |
| --- | --- | --- | --- |
| `MailSender` | every email is stored in the `outbox_emails` table and shown in the admin Outbox | Resend, in addition to the outbox | `RESEND_API_KEY` + `MAIL_FROM` |
| `DocumentStore` | PDF bytes in Postgres (`bytea`), 5 MB cap | Cloudflare R2 | `R2_*` variables (documented, not built) |
| `RegistryCheck` | VIES; FMCSA when a key exists | more registries | one entry per country profile |

⚠ Mail: without a domain Resend delivers only to the account owner's own
address, so real applicants cannot receive links until a domain is bought
(about $10 a year). Until then the admin opens the link from the Outbox, or
copies it to the applicant by hand. The outbox keeps recording after Resend is
on: it is also the audit trail.

⚠ Documents in Postgres: Neon's free plan has 0.5 GB of storage. At two files
of up to 5 MB each, about 50 applications fill it in the worst case. The
application list shows total stored megabytes so this is visible, and the
documents of a rejected application are deleted 30 days after the decision.
R2 is not used now because enabling it asks for a bank card.

The R2 implementation is documented but not written in this feature: an unused,
untested adapter would rot. `docs/deploy-free.md` gets a section listing the
variables it will need and the one file to add.

## Carriers move into the database

Today carriers are reference data in code, loaded into an in-memory map
(`backend/src/data/store.ts`), and the quote service reads that map
synchronously. An approved carrier must survive a restart, so:

- A `carriers` table is added. The seeded carriers stay in code and are
  upserted at start (their ids are already stable UUID v5).
- The in-memory map stays as a read cache, filled from the table at start and
  updated when a carrier is approved. Every existing synchronous reader keeps
  working unchanged.

⚠ With more than one backend instance, a carrier approved on one would be
missing from the other's cache until restart. Render's free plan runs one
instance. Moving to several needs a cache refresh (noted in the docs).

## Data

```
carriers              carrier_id, name, legal_name, transport_types[], cargo_categories[], created_at
carrier_applications  application_id, status, form fields..., registry_result, registry_name,
                      reject_reason, carrier_id (after approval), created_at, confirmed_at, decided_at,
                      decided_by
application_documents document_id, application_id, kind (REGISTRATION | INSURANCE),
                      file_name, size_bytes, content bytea
onboarding_tokens     token_hash, application_id, purpose (CONFIRM_EMAIL | SET_PASSWORD),
                      expires_at, used_at
outbox_emails         email_id, to_email, subject, body_text, link, created_at, delivered_via
```

One open application per email: a partial unique index on `email` where status
is `EMAIL_PENDING` or `PENDING_REVIEW`. Approve and reject use the same guarded
update the shipments use (`UPDATE ... WHERE status = 'PENDING_REVIEW'`), so two
admins pressing at once cannot both win.

## API

Public:

- `GET  /api/onboarding/countries` → country profiles.
- `POST /api/onboarding/applications` → multipart form; always `202`.
- `POST /api/onboarding/confirm-email` `{token}` → `200`, or `410` when the
  token is used or expired.
- `GET  /api/onboarding/set-password/:token` → `{companyName, email}` or `410`.
- `POST /api/onboarding/set-password` `{token, password}` → creates the manager,
  sets the session cookie.

Admin only (`requireRole("ADMIN")`):

- `GET  /api/admin/applications?status=` → list, newest first, with a count per status.
- `GET  /api/admin/applications/:id` → full detail.
- `GET  /api/admin/applications/:id/documents/:documentId` → the PDF, sent with
  `Content-Disposition: attachment`, `Content-Type: application/pdf` and
  `X-Content-Type-Options: nosniff`, so an uploaded file is never rendered as a
  page on our origin.
- `POST /api/admin/applications/:id/approve`
- `POST /api/admin/applications/:id/reject` `{reason}` (10–1000 characters)
- `POST /api/admin/applications/:id/recheck`
- `GET  /api/admin/outbox` → latest 100 emails.

Uploads use `multer` with memory storage and the 5 MB cap. It is the one new
backend dependency. The Cloudflare Worker already streams request bodies to
Render; a Worker request may carry up to 100 MB on the free plan.

## Screens

### Choose a role (`/signup`)

Two large cards side by side (stacked on a phone), in the style of AWS's
"choose a use case" pickers:

- **Customer** — "I ship cargo". Illustration: a parcel on a conveyor.
- **Carrier** — "I move cargo". Illustration: a truck on a road.

The illustrations are our own inline SVG in the site palette, so they cost no
request, need no licence, and can be animated part by part:

- on load the cards rise in with the existing `stagger` timing;
- on hover or keyboard focus the card lifts (`card-hover`), its border turns
  red, and the illustration plays: the truck drives a short way and its wheels
  turn; the parcel slides along the belt;
- choosing a card marks it with a red check and moves on.

All of it stops under `prefers-reduced-motion`; the cards are real links, so
they work with a keyboard and without JavaScript animation. The header's
"Sign in" page keeps sign-in only and links to `/signup`; the "Create account"
tab moves there.

### Customer (`/signup/customer`)

The existing registration form, unchanged in fields.

### Carrier application (`/signup/carrier`)

One page in three titled blocks: Company, Contact, What you carry and documents.
Problems are shown under the field after the first submit attempt, as in the
console forms. The registration number's label, hint and format follow the
chosen country. File inputs show the chosen file's name and size and refuse
non-PDF or larger files before upload. After submit: a "Check your mailbox"
screen naming the address.

### Email links

- `/signup/confirm?token=` → "Email confirmed. We will review your application."
  or "This link has expired."
- `/signup/set-password?token=` → company name, one password field → console.

### Admin (`/admin`)

Same shell as the console (side menu, white cards). Two sections:

- **Applications** — tabs by status with counts; a table (company, country,
  registry mark, submitted). A row opens the detail: every field, the registry
  result, the two documents as download buttons, then **Approve** and
  **Reject** (reject opens a dialog that requires the reason).
- **Outbox** — the latest emails: to, subject, time, and an "Open link" button.
  A banner says whether real delivery is on.

The header shows "Admin" for an `ADMIN` user, as it shows "Console" for a manager.

## Emails

Plain text, five of them: confirm your email; application received (after
confirming); approved with the set-password link; rejected with the reason;
"you already have an account". Each is a small pure function `(data) =>
{subject, text, link}` with a test.

## Environment variables

| Name | Needed | Effect when missing |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | yes in production | links in emails cannot be built; the server refuses to start |
| `TURNSTILE_SECRET` | no | bot check skipped, warning logged |
| `VITE_TURNSTILE_SITE_KEY` | no (frontend build) | the widget is not rendered |
| `FMCSA_WEB_KEY` | no | US checks report `UNAVAILABLE` |
| `RESEND_API_KEY`, `MAIL_FROM` | no | emails stay in the outbox only |

## Testing

- Pure logic with unit tests: country profile validation, token hashing and
  expiry, email builders, the status machine, PDF sniffing.
- Repository contract tests extended to the new tables, on both stores.
- Service tests for the whole path with a fake clock and fake registry.
- Frontend tests for the form's validation helpers and the admin access rule.
- A manual walk on a local copy: apply → Outbox → confirm → approve → set
  password → console; reject path; expired link; phone width; reduced motion.

## Delivery

One pull request per plan task, each from the latest `main`, reviewed by the
owner. No direct pushes to `main`.
