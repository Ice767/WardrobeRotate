# Carrier console and the Cargoa look

Date: 2026-11-04. Approved mockup: "Cargoa Carrier Console", variant A (Light).

## Why

Carriers (role `MANAGER`) can only work through raw API calls today: there is no
screen to publish tariffs, answer quote requests or move shipments along. The
whole marketplace depends on carriers doing those three things. At the same time
the owner wants the site to look like a strict, console-style marketplace
(Cloudflare-like), lively rather than static, in their own palette.

## Goals

1. A carrier console at `/console` for `MANAGER` users with four sections:
   Overview, Tariffs, Quote requests, Shipments, plus search results.
2. The whole site (client pages included) moves to the new look: palette,
   fonts, header, cards, motion. Site name becomes **Cargoa** everywhere.
3. Live search in the header of the console (details below).
4. Motion as in the mockup, switched off under `prefers-reduced-motion`.

## Non-goals

- Admin screens (creating managers, users list). Separate piece of work.
- New backend endpoints. The console uses the API that exists.
- AI features. Discussed separately after this.
- Dark theme.

## Anti-goals

- Anything that makes the carrier wait or guess: every action shows its result
  (toast + highlighted row) or a clear error.
- Decorative motion that slows work down: animations stay under ~0.7 s and never
  block clicks.
- Fake numbers. Mockup values were illustrations; the real console shows only
  data from the API.

## Look (decided)

Palette, from the owner:

| Token | Hex | Use |
| --- | --- | --- |
| red | `#E63946` | primary buttons, logo, active marker, focus ring |
| cream | `#F1FAEE` | page background, search field background |
| navy | `#1D3557` | text, headings, toast background |
| aqua | `#A8DADC` | active nav item, hover tints, row flash, chart bars |

Header and side menu are white; content cards are white with 10 px radius and a
light border; status values are rounded "pills". Fonts: Inter for text,
JetBrains Mono for codes, prices and numbers. The mockup's variant A is the
reference for spacing and layout.

Motion (decided): staggered entrance of cards and rows (60 ms step), hover lift
on cards and buttons, nav item nudge on hover, badge bump when a count changes,
progress track under each shipment status that slides on change, toast
bottom-right for 2.6 s, short aqua flash on the changed row, breathing logo.

## Console behaviour (decided)

- **Access.** `/console` and its sections require a signed-in `MANAGER`.
  Signed out: go to sign-in and come back. Signed in with another role: a short
  "This area is for carriers" message, no redirect loop. A manager who opens
  `/account` is sent to `/console`.
- **Routes.** `/console`, `/console/tariffs`, `/console/requests`,
  `/console/shipments`, `/console/search?q=`. Real URLs, so back/forward and
  links work.
- **Overview.** Counters: active tariffs, requests waiting for this carrier's
  answer, shipments not yet delivered, total booked this calendar month (sum of
  this carrier's shipment prices). A "Needs your answer" list of open requests.
  The small bar chart is shown only on "Booked this month" and comes from real
  data (bookings per week, last 7 weeks); other cards have no chart.
- **Tariffs.** Table of the carrier's tariffs; "Create tariff" opens an inline
  form (from region, to region, mode, rate, minimum, transit days, and whatever
  else `POST /api/tariffs` requires); edit and delete per row. Validation errors
  from the API are shown next to the fields, in words, not "validation failed".
- **Quote requests.** Cards for requests this carrier was invited to: route,
  cargo, weight and volume, the indicative range when there is one, expiry.
  Answer with a firm price (and mode, as the API requires). Answered requests
  show the sent price and wait for the client. Expired or closed ones are
  greyed out.
- **Shipments.** Table with tracking code, route, price, status pill, progress
  track, and one button for the next allowed step. Cancelled and delivered rows
  have no button.
- **Search.** Filters data already loaded in the console (tariffs, requests,
  shipments); no backend search. Typing shows a dropdown with up to 6 matches
  grouped by kind; no matches shows "No results for …" and Enter does nothing;
  Enter with matches opens `/console/search?q=…` with all matches grouped;
  Esc closes the dropdown; clicking a match opens its section and flashes the
  row.

## Client pages (decided)

Quote, sign-in, account and tracking pages keep their behaviour and get the new
look. Also fixed while restyling:

- the quote form checks the limits (68 000 kg, 138 m³) and says so in words;
- the header and page titles say Cargoa instead of Freight Market.

## Builder's calls (left to the builder)

- Component structure, file names, whether animations live in MUI `sx`, a
  global stylesheet or a small helper.
- How the console caches and refreshes data (RTK Query tags as elsewhere).
- Exact wording of empty states and errors, in English.
- Mobile layout: side menu stacks above content under ~768 px; tables scroll
  horizontally inside their card.

## Demo carrier account (decided)

There are no manager accounts and no admin screen yet, so the seed adds one demo
manager tied to an existing seeded carrier (AeroFreight), the same way the admin
is seeded:

- email `manager@aerofreight.dev`;
- password from `SEED_MANAGER_PASSWORD`. Unlike the admin, a missing value does
  not stop the server: the demo manager is simply not created, and a log line
  says so. Development falls back to a fixed dev password, as the admin does.
- `render.yaml` lists `SEED_MANAGER_PASSWORD` with `sync: false`;
  `docs/deploy-free.md` and the README env table mention it.

## What comes next (separate design)

Real carrier onboarding replaces the demo account as the way carriers appear:
a country-agnostic sign-up form with documents, email confirmation, an admin
approval queue and an outbox that shows emails instead of sending them until a
domain is paid for. It gets its own design document after this one ships.

## Delivery

One branch, one pull request, reviewed by the owner before merge (no direct
pushes to `main`). Frontend tests for the search filter and the access rules;
manual check of every section in the browser on a local copy before the PR.
