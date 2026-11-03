# Carrier Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/console` for carrier managers (overview, tariffs, quote requests, shipments, live search) and the whole site restyled to the Cargoa look, with a demo manager seeded so it can be used.

**Architecture:** Frontend-only features on top of the existing API, plus one backend seed change. Pure logic (search, stats, access, money parsing, status steps, request state) lives in small `frontend/src/console/*.ts` modules with Vitest tests; pages are thin MUI components using RTK Query hooks added to `api.ts`. Motion is one global stylesheet with class names reused by every page.

**Tech Stack:** React 19, MUI 9, RTK Query, React Router 7, Vitest + Testing Library (frontend); Express 5 + `node:test` (backend).

**Spec:** `docs/superpowers/specs/2026-11-04-carrier-console-design.md`. Visual reference: mockup variant A, https://claude.ai/artifact/GsK3UAtB3XTaHuqN1S5gaX.

## Global Constraints

- Palette exactly: red `#E63946`, cream `#F1FAEE`, navy `#1D3557`, aqua `#A8DADC`. Header and side menu white, cards white, radius 10 px, border `#e5e7eb`.
- Fonts: Inter (text), JetBrains Mono (codes, prices, numbers). Old Barlow/Saira/IBM Plex fonts are removed.
- Site name "Cargoa" everywhere a name is shown, including `<title>`.
- All animations ≤ 0.7 s, never block clicks, all off under `prefers-reduced-motion: reduce`.
- No new backend endpoints. No fake numbers: every figure comes from the API.
- All code, comments and copy in English, no Cyrillic.
- Money is integer cents on the wire; the UI shows dollars.
- One branch `feature/carrier-console`, one PR; commits carry no Claude/Anthropic/Co-Authored-By lines.

## Review Focus

1. A `MANAGER` whose `carrierId` is missing → console shows the "for carriers" message, not a crash (Task 5 test).
2. Session expires while in the console (any query returns 401) → back to sign-in with return to the same page (Task 5 test on `consoleAccess`).
3. Price typed as `5,20`, ` 5.2 `, `0`, `-1`, `abc`, `5.205` → comma accepted, spaces trimmed, the rest rejected with a word message, never sent (Task 8 tests).
4. Search query with only spaces or regex characters like `(` or `.*` → treated as plain text, no throw (Task 6 tests).
5. Answering a request that expired while the page was open → the API error text is shown on that card, the card turns closed after refetch (Task 9 test on `requestState` with `now` past `expiresAt`).

---

### Task 1: Seed a demo manager

**Files:**
- Modify: `backend/src/data/seed.ts`
- Create: `backend/src/data/seed.test.ts`
- Modify: `render.yaml`, `docs/deploy-free.md`, `README.md` (env table)

**Interfaces:**
- Produces: user `manager@aerofreight.dev`, role `MANAGER`, `carrierId = carrierIdBySlug("aerofreight")`.

- [ ] **Step 1: Write the failing tests** in `seed.test.ts` (style of `auth.service.test.ts`):
  - `creates the demo manager bound to AeroFreight when SEED_MANAGER_PASSWORD is set` → after `seedDemoData()`, `findUserByEmail("manager@aerofreight.dev")` has `role === "MANAGER"` and `carrierId === carrierIdBySlug("aerofreight")`.
  - `skips the demo manager in production without SEED_MANAGER_PASSWORD` → with `NODE_ENV=production`, `SEED_ADMIN_PASSWORD` set, `SEED_MANAGER_PASSWORD` unset: `seedDemoData()` resolves and the user does not exist.
  - `does not fail when run twice` → two calls resolve.
- [ ] **Step 2:** `cd backend && npm test` → the new tests FAIL.
- [ ] **Step 3: Implement** in `seed.ts`: `MANAGER_EMAIL = "manager@aerofreight.dev"`, `DEV_MANAGER_PASSWORD = "ManagerPass123!"`, `managerPassword(): string | undefined` (env value; dev fallback outside production; `undefined` in production). In `seedDemoData`, restructure so admin and manager are each created only if missing (the early `return` must not skip the manager). When `undefined`, log one info line "Demo manager not created: SEED_MANAGER_PASSWORD is not set" with the existing logger.
- [ ] **Step 4:** `npm test` → all pass (68 + new).
- [ ] **Step 5:** add `SEED_MANAGER_PASSWORD` (`sync: false`) to `render.yaml`; one row in the README env table and the secrets table of `docs/deploy-free.md`.
- [ ] **Step 6: Commit** "Seed a demo carrier manager".

### Task 2: Cargoa theme, fonts and motion

**Files:**
- Modify: `frontend/src/theme.ts`, `frontend/index.html`, `frontend/src/main.tsx`
- Create: `frontend/src/motion.css`
- Modify: `frontend/src/components/Header.tsx`

**Interfaces:**
- Produces: `colors` keys `red, cream, navy, aqua, surface, line, muted, ink` (ink = navy, muted `#4a5d78`, line `#e5e7eb`, surface `#ffffff`); `fonts.body`, `fonts.mono`. Old keys used by pages (`ground, accent, accentSoft, instant, instantSoft, request, requestSoft, field, rule, display, small`) stay as aliases mapped onto the new palette until Task 3 removes their uses.
- Produces CSS classes: `enter`, `stagger` (with inline `animation-delay`), `card-hover`, `btn-lift`, `nav-nudge`, `row-flash`, `pulse`, `bump`, `track-fill`, `toast-in`, `logo-breathe`. Keyframes and timings copied from the mockup's `<helmet>` style (A variant).

- [ ] **Step 1:** `index.html`: title "Cargoa"; font link → `Inter:wght@400;500;600;700` and `JetBrains+Mono:wght@400;500`.
- [ ] **Step 2:** `theme.ts`: palette primary `#E63946`, background default `#F1FAEE`, text primary `#1D3557`; Paper radius 10, border `#e5e7eb`; typography Inter, h1 24–28 px weight 600 (no condensed display font); Button radius 8, hover via `btn-lift`.
- [ ] **Step 3:** `motion.css` with the classes above, including `@media (prefers-reduced-motion: reduce) { *{animation:none!important;transition:none!important} }`; import it in `main.tsx`.
- [ ] **Step 4:** Header: white bar with bottom border, breathing red "C" logo + "Cargoa"; links as now plus "Console" for `MANAGER` (instead of "My shipments").
- [ ] **Step 5:** `npm run build` and `npm test` in `frontend` → succeed.
- [ ] **Step 6: Commit** "Restyle the site in the Cargoa palette".

### Task 3: Client pages in the new look, quote limits in words

**Files:**
- Create: `frontend/src/lib/quoteLimits.ts`, `frontend/src/lib/quoteLimits.test.ts`
- Modify: `frontend/src/pages/QuotePage.tsx`, `SignInPage.tsx`, `AccountPage.tsx`, `TrackingPage.tsx`, `components/OfferCard.tsx`, `theme.ts` (drop the aliases)

**Interfaces:**
- Produces: `MAX_WEIGHT_KG = 68_000`, `MAX_VOLUME_M3 = 138`, `weightProblem(raw: string): string | null`, `volumeProblem(raw: string): string | null`.

- [ ] **Step 1: Failing tests:** `weightProblem("")` → "Enter the weight in kilograms"; `weightProblem("68001")` → "The heaviest single shipment any carrier takes is 68 000 kg. Split the load."; `weightProblem("68000")` → null; `volumeProblem("139")` → "The largest single shipment any carrier takes is 138 m³. Split the load."; `volumeProblem("0")` → "Enter the volume in cubic meters".
- [ ] **Step 2:** `npx vitest run src/lib/quoteLimits.test.ts` → FAIL.
- [ ] **Step 3:** implement; `QuotePage` uses them instead of its inline `problems.weight/volume`.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** restyle the four pages and `OfferCard` with the new tokens and motion classes (cards `stagger` + `card-hover`, results list staggered, pills for statuses); remove the alias keys from `theme.ts`; `npm run build` passes (no dangling alias use).
- [ ] **Step 6: Commit** "Bring client pages to the new look and explain quote limits".

### Task 4: Console API hooks

**Files:**
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/api.ts`

**Interfaces:**
- Produces types: `Tariff` (fields as backend `tariff.contract.ts`), `CreateTariffBody = Omit<Tariff, "tariffId" | "carrierId">`, `UpdateTariffBody = Partial<Pick<Tariff, "pricePerKgCents" | "pricePerM3Cents" | "minChargeCents" | "transitDays">>`, `SubmitRfqQuoteBody = {transportType: TransportType; priceCents: number; transitDays: number; validUntil: string; comment?: string}`.
- Produces hooks: `useTariffsQuery()` (GET `/tariffs`, tag `Tariffs`), `useCreateTariffMutation(body)`, `useUpdateTariffMutation({tariffId, body})` (PATCH), `useDeleteTariffMutation(tariffId)`, `useSubmitRfqQuoteMutation({rfqId, body})` (POST `/rfqs/:rfqId/quotes`, invalidates `Rfqs`), `useChangeShipmentStatusMutation({shipmentId, status})` (POST `/shipments/:shipmentId/status`, invalidates `Shipments`). Add `"Tariffs"` to `tagTypes`; login/logout also invalidate it.
- Also fix the stale comment in `api.ts` ("Amplify rewrites it" → the Cloudflare Worker proxies it).

- [ ] **Step 1:** add types and endpoints.
- [ ] **Step 2:** `npm run build` → passes.
- [ ] **Step 3: Commit** "Add console endpoints to the API client".

### Task 5: Console shell and access rules

**Files:**
- Create: `frontend/src/console/access.ts`, `access.test.ts`, `ConsoleLayout.tsx`, `ConsoleNav.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/pages/AccountPage.tsx`, `frontend/src/pages/SignInPage.tsx` (return to `state.from` already supported; check it accepts `/console/...`)

**Interfaces:**
- Produces: `type ConsoleAccess = "loading" | "signin" | "forbidden" | "ok"`; `consoleAccess(me: PublicUser | undefined, meError: boolean, isLoading: boolean): ConsoleAccess`.
- Produces: `<ConsoleLayout />` renders header search slot (Task 6), side nav (Overview, Tariffs, Quote requests, Shipments with counts) and `<Outlet />`; on `"signin"` → `<Navigate to="/signin" state={{from: location.pathname + location.search}} replace />`; on `"forbidden"` → panel "This area is for carriers." with a link home.
- Routes: `/console` (index → Overview), `/console/tariffs`, `/console/requests`, `/console/shipments`, `/console/search`. Pages are placeholders until their task.

- [ ] **Step 1: Failing tests:** loading → `"loading"`; error (401) → `"signin"`; no user, not loading → `"signin"`; CLIENT → `"forbidden"`; ADMIN → `"forbidden"`; MANAGER without carrierId → `"forbidden"`; MANAGER with carrierId → `"ok"`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** layout, nav (active item aqua background, red marker, `nav-nudge`, count badge with `bump` when the count changes), routes; `AccountPage` redirects `MANAGER` to `/console`.
- [ ] **Step 6:** build passes. **Commit** "Add the carrier console shell".

### Task 6: Live search

**Files:**
- Create: `frontend/src/console/search.ts`, `search.test.ts`, `ConsoleSearch.tsx`, `SearchPage.tsx`

**Interfaces:**
- Consumes: `Tariff[]`, `Rfq[]`, `Shipment[]`, a `regionName(id): string` lookup.
- Produces: `type SearchHit = {kind: "Tariff" | "Request" | "Shipment"; id: string; title: string; sub: string; to: string}` where `to` is the section path plus `?focus=<id>`; `searchConsole(query: string, data: {tariffs; rfqs; shipments; regionName}): SearchHit[]`.
- Rules: trim; empty → `[]`; case-insensitive substring over `title + sub + kind` (no RegExp built from input); tariffs titled `"<MODE> · $x.xx / kg"` with sub `"<from> → <to>"`; requests titled by short id `RFQ-` + first 8 chars of `rfqId` upper-cased; shipments titled by `trackingCode`, sub route + status in lower case.

- [ ] **Step 1: Failing tests:** `"   "` → `[]`; `"houston"` finds a tariff and a shipment whose route has Houston; `"fm-6ffz"` finds `FM-6FFZNQWE`; `"("` and `".*"` → `[]` without throwing; results ordered Tariff, Request, Shipment.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `ConsoleSearch` in the console header: dropdown on typing with up to 6 hits (`stagger`), footer "N results · Enter to see all"; no hits → "No results for “q”" with a hint, Enter ignored; Enter with hits → `navigate("/console/search?q=" + encodeURIComponent(q))`; Esc closes; outside click closes. Clicking a hit navigates to `hit.to`. `SearchPage` reads `q` from the URL, groups hits by kind with counts, each row a link "Open →".
- [ ] **Step 6:** section pages read `focus` from the URL and add `row-flash` to that row once.
- [ ] **Step 7:** build passes. **Commit** "Add live search to the console".

### Task 7: Overview

**Files:**
- Create: `frontend/src/console/stats.ts`, `stats.test.ts`, `OverviewPage.tsx`

**Interfaces:**
- Produces: `consoleStats(input: {carrierId: string; tariffs: Tariff[]; rfqs: Rfq[]; shipments: Shipment[]; now: Date}): {activeTariffs: number; requestsToAnswer: number; inProgress: number; bookedThisMonthCents: number; weeklyBookingsCents: number[]}`.
- Rules: `requestsToAnswer` counts `requestState(...) === "open"` (Task 9 helper — implement `requestState` here in `requests.ts` if Task 9 is not done yet, Task 9 then only uses it); `inProgress` = status not `DELIVERED`/`CANCELLED`; booked month = shipments not cancelled with `createdAt` in `now`'s calendar month (UTC); weekly = 7 numbers, oldest first, each a 7-day window ending at `now`.

- [ ] **Step 1: Failing tests:** cancelled shipment excluded from both money figures; shipment from last month excluded from month but present in weekly when within 49 days; `weeklyBookingsCents.length === 7`; an RFQ already answered by this carrier not counted.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** page: four stat cards (`stagger`, `card-hover`, mono numbers), bar chart only on "Booked this month" (bars `grow` with staggered delays, last bar red, others aqua); "Needs your answer" list linking to `/console/requests?focus=<rfqId>`; empty state "All requests answered."
- [ ] **Step 6: Commit** "Add the console overview".

### Task 8: Tariffs

**Files:**
- Create: `frontend/src/console/money.ts`, `money.test.ts`, `TariffsPage.tsx`, `TariffForm.tsx`

**Interfaces:**
- Produces: `parseDollars(raw: string): {cents: number} | {error: string}`; `formatDollars(cents: number): string` (reuse `formatCents` from `lib/format.ts` if it matches).
- Rules: trim; one comma treated as a dot; at most 2 decimals; result `0 ≤ cents ≤ 10_000_000`; errors "Enter an amount in dollars, like 5.20", "Use at most two decimals", "That is more than $100 000".

- [ ] **Step 1: Failing tests:** `"5.20"`→520; `" 5,2 "`→520; `"0"`→0; `"-1"`, `"abc"`, `""` → error; `"5.205"` → decimals error; `"100001"` → too much.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** page: table of `useTariffsQuery()` (lane names via regions, mode, $/kg, $/m³, minimum, transit days, Active pill with `pulse`); "Create tariff" toggles `TariffForm` (`enter`): from/to `RegionPicker`, mode select, $/kg, $/m³, minimum, transit days. Client checks before sending: from ≠ to, at least one of the two rates > 0, days 1–365. Server errors via `errorText` under the form. Row actions: Edit (same form, lane fields disabled, PATCH only prices/days) and Delete with a confirm dialog. On success: toast + `row-flash` on the row.
- [ ] **Step 6:** shared `useToast()` + `<ConsoleToast />` (navy, aqua check, `toast-in`, 2.6 s) in `frontend/src/console/toast.tsx`, mounted once in `ConsoleLayout`.
- [ ] **Step 7: Commit** "Let carriers manage tariffs in the console".

### Task 9: Quote requests

**Files:**
- Create: `frontend/src/console/requests.ts` (if not created in Task 7), `requests.test.ts`, `RequestsPage.tsx`

**Interfaces:**
- Produces: `requestState(rfq: Rfq, carrierId: string, now: Date): "open" | "answered" | "closed"` — closed when `status !== "OPEN"` or `now >= expiresAt`; answered when a quote with this `carrierId` exists; else open. `RequestsPage` lists RFQs with `eligibleCarrierIds.includes(carrierId)`, open first, then answered, then closed.

- [ ] **Step 1: Failing tests:** open; answered; `status: "ACCEPTED"` → closed; `now` one second past `expiresAt` → closed even with `status: "OPEN"`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** cards (`stagger`, `card-hover`): short id, category pill, route, cargo category label, weight · volume, expiry as "Expires in 2 d 4 h"; open card form: mode (from transport types), price via `parseDollars`, transit days, optional comment; `validUntil` = `rfq.expiresAt`. Answered: "Price sent: $x · waiting for the client". Closed: greyed, no form. API errors shown on the card. Toast on success.
- [ ] **Step 6: Commit** "Let carriers answer quote requests".

### Task 10: Shipments

**Files:**
- Create: `frontend/src/console/shipmentSteps.ts`, `shipmentSteps.test.ts`, `ShipmentsPage.tsx`

**Interfaces:**
- Produces: `nextStatus(status: ShipmentStatus): ShipmentStatus | null` (CONFIRMED→PICKED_UP→IN_TRANSIT→DELIVERED; DELIVERED and CANCELLED → null); `progressPercent(status): number` (0, 33, 67, 100; CANCELLED 0).

- [ ] **Step 1: Failing tests** for every status in both functions.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** table: tracking code (mono, links to `/track/:code`), route, price, status pill (`pulse` on IN_TRANSIT), progress track (`track-fill` width transition), button "Mark <next>" or "Complete"/"Cancelled". On success: toast + `row-flash`.
- [ ] **Step 6: Commit** "Let carriers move shipments along".

### Task 11: Verify and open the PR

- [ ] **Step 1:** `cd backend && npm test` and `cd frontend && npm test && npm run build && npm run lint` → all pass.
- [ ] **Step 2:** run the stack locally (Docker Postgres, backend, `wrangler dev` as in earlier sessions), sign in as the demo manager and as a client; walk every section at 1360 px and 375 px: create/edit/delete a tariff, answer a request (create one first as the client with "Dangerous"), move a shipment to delivered, search with hits, no hits, Enter, Esc. Check reduced motion in the browser's emulation.
- [ ] **Step 3:** add a line to `docs/study-notes.md`: "Why the console's search filters loaded data instead of calling the server" — `frontend/src/console/search.ts`.
- [ ] **Step 4:** push `feature/carrier-console`, open a PR to `main` titled "Carrier console and the Cargoa look"; body lists what changed, how it was checked, and the new env var `SEED_MANAGER_PASSWORD` the owner must set on Render.
