# Carrier Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A company can apply to become a carrier, confirm its email, be approved or rejected by the admin, set a password and enter the console; the admin has a queue and an Outbox. Nothing costs money.

**Architecture:** A new `onboarding` slice on the backend (contract, service, validators, controller, routes) on top of four new tables, with three small interfaces ("sockets") for mail, document storage and registry checks, each with a free default. Carriers move from code into a table while the in-memory map stays as a read cache. The frontend gets `/signup` (role cards, customer form, carrier form, email-link pages) and `/admin` (applications, outbox).

**Tech Stack:** Express 5, zod, pg, `node:test`, `multer` (new); React 19, MUI 9, RTK Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-carrier-onboarding-design.md`.

## Global Constraints

- No spending: no paid service, nothing that asks for a bank card. Mail goes to the outbox; documents go to Postgres.
- Every socket switches by environment variables only. A missing optional variable never stops the server; it logs one line at start.
- All code, comments, copy and seed data in English, no Cyrillic.
- Secrets never appear in logs, responses or the Outbox list beyond the link itself. Tokens are stored as SHA-256 hashes only.
- Service functions take `now: Date` (as RFQ and shipments do) so tests need no timers.
- New backend code follows the existing layout: `contracts/`, `validators/`, `services/`, `controllers/`, `routes/`, tests beside the code.
- Frontend follows the console: pure logic in small `.ts` modules with tests, thin MUI pages, motion classes from `motion.css`, all motion off under `prefers-reduced-motion`.
- One PR per task, branched from the latest `origin/main` (or from the previous task's branch if that PR is not merged yet — say so). Commits and PR text carry no Claude/Anthropic/Co-Authored-By lines.
- Mark every hosting or scaling caveat with ⚠ in the task write-up and in the docs.

## Review Focus

1. The submit answer is identical for a new email, an email with an account and an email with an open application (Task 5 test).
2. A token works once, and not after its expiry; the raw token is never stored (Task 3 tests).
3. Two approvals at once: exactly one succeeds, one carrier is created (Task 7 test on the guarded update).
4. A file named `x.pdf` whose bytes are HTML is refused (Task 4 test).
5. A carrier approved at runtime is offered by `POST /api/quotes` once it has a tariff, and still exists after a restart (Task 1 contract test + Task 12 manual check).
6. Documents are served as attachments with `nosniff`, admin only; a manager or client gets 403 (Task 7 test).

---

### Task 1: Carriers in the database

**Files:**
- Modify: `backend/src/db/schema.ts`, `backend/src/repositories/{types,memory,postgres,index}.ts`, `backend/src/repositories/repositories.contract.test.ts`, `backend/src/data/reference.seed.ts`, `backend/src/services/carrier.service.ts`, `backend/src/server.ts`

**Interfaces:**
- Produces: `CarrierRepository { list(): Promise<Carrier[]>; upsert(carrier): Promise<void> }` on `Repositories.carriers`; `addCarrier(carrier): Promise<void>` in `carrier.service.ts` (writes the table, then the `carriersById` cache); `loadCarriers(): Promise<void>` called at start after seeding.

- [ ] **Step 1: Failing contract tests**: `upsert` then `list` returns the carrier with arrays intact; `upsert` twice with the same id keeps one row and the newer name.
- [ ] **Step 2:** `cd backend && npm test` → FAIL.
- [ ] **Step 3: Implement.** Table `carriers (carrier_id uuid PRIMARY KEY, name text NOT NULL, legal_name text NOT NULL, transport_types text[] NOT NULL, cargo_categories text[] NOT NULL, created_at timestamptz NOT NULL)`. At start: upsert the seeded carriers, then `loadCarriers()` fills `carriersById` from the table. Update the schema comment that says carriers live in code.
- [ ] **Step 4:** `npm test` → all pass; start the server locally and confirm `GET /api/carriers` still returns the four seeded carriers.
- [ ] **Step 5:** note in `docs/study-notes.md`: "Why the carrier map stayed as a cache when carriers moved to a table" (⚠ single instance).
- [ ] **Step 6: Commit** "Store carriers in the database".

### Task 2: Country profiles

**Files:**
- Create: `backend/src/contracts/onboarding.contract.ts`, `backend/src/services/country.profiles.ts`, `country.profiles.test.ts`
- Create: `backend/src/routes/onboarding.routes.ts`, `backend/src/controllers/onboarding.controller.ts`; mount in `app.ts` at `/api/onboarding`

**Interfaces:**
- Produces: `COUNTRY_PROFILES`, `profileFor(code)`, `registrationProblem(code, value): string | null`; `GET /api/onboarding/countries` → `[{code, name, registrationLabel, registrationHint, licenceLabel, registry}]` (patterns stay on the server).

- [ ] **Step 1: Failing tests**: valid and invalid numbers for `US`, `IL`, `RU`, one EU state and `OTHER`; unknown country code → problem; every profile has a non-empty label and hint.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** "Describe each country's company numbers as data".

### Task 3: Tokens, mail socket and the outbox

**Files:**
- Create: `backend/src/services/onboarding.tokens.ts` + test, `backend/src/services/mail/{mail.types,outbox.sender,resend.sender,index}.ts` + tests, `backend/src/services/mail/templates.ts` + test
- Modify: `backend/src/db/schema.ts`, repositories (+ contract tests)

**Interfaces:**
- Produces: `newToken(): {raw, hash}`, `hashToken(raw)`; `MailSender.send({to, subject, text, link})`; `mailSender()` returns the outbox sender, wrapped with Resend when `RESEND_API_KEY` and `MAIL_FROM` are set; five template functions `(data) => {subject, text, link}`; `siteUrl(path)` built from `PUBLIC_SITE_URL`.

- [ ] **Step 1: Failing tests**: a hash is 64 hex characters and differs from the raw token; two tokens differ; `OutboxSender.send` stores a row; a Resend failure still leaves the outbox row and does not throw; each template contains its link and no `undefined`.
- [ ] **Step 2–4:** FAIL → implement → PASS. Tables `onboarding_tokens`, `outbox_emails` as in the spec. Resend is called with `fetch` (no SDK dependency). In production a missing `PUBLIC_SITE_URL` stops the start, like the admin password does.
- [ ] **Step 5:** `render.yaml`: `PUBLIC_SITE_URL` (value), `RESEND_API_KEY`, `MAIL_FROM` (`sync: false`).
- [ ] **Step 6: Commit** "Add one-time tokens and an email outbox".

### Task 4: Document storage socket

**Files:**
- Create: `backend/src/services/documents/{document.types,postgres.store,memory.store,pdf.ts,index}.ts` + tests
- Modify: `backend/src/db/schema.ts`

**Interfaces:**
- Produces: `DocumentStore { put(doc): Promise<void>; get(documentId): Promise<StoredDocument | undefined>; deleteForApplication(id): Promise<void>; totalBytes(): Promise<number> }`; `isPdf(bytes: Buffer): boolean`; `MAX_DOCUMENT_BYTES = 5 * 1024 * 1024`.

- [ ] **Step 1: Failing tests**: `isPdf` accepts `%PDF-1.7…`, refuses HTML, an empty buffer and a 3-byte buffer; store round-trips bytes exactly; `totalBytes` sums sizes.
- [ ] **Step 2–4:** FAIL → implement → PASS (memory store always; Postgres store under `TEST_DATABASE_URL`, as the contract tests do).
- [ ] **Step 5: Commit** "Store application documents behind an interface".

### Task 5: Submit an application and confirm the email

**Files:**
- Create: `backend/src/services/onboarding.service.ts` + test, `backend/src/validators/onboarding.validator.ts`, `backend/src/services/turnstile.ts` + test
- Modify: onboarding controller and routes, repositories (application table + contract tests), `backend/src/middlewares/rate-limit.middleware.ts`, `backend/package.json` (`multer`, `@types/multer`)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `submitApplication(input, files, now)`, `confirmEmail(rawToken, now)`; `POST /api/onboarding/applications` (multipart, fields `registrationDocument`, `insuranceDocument`, `turnstileToken`) → always `202 {message}`; `POST /api/onboarding/confirm-email` → `200` or `410`.

- [ ] **Step 1: Failing service tests**: a valid submit stores `EMAIL_PENDING`, two documents and one outbox email; the response is identical for an email that has an account (and that email gets the "already have an account" text, no application stored) and for one with an open application; a non-PDF file → 400 naming the field; confirm moves to `PENDING_REVIEW` and sends "application received"; a used token → 410; a token past 48 h → 410.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implement.** zod validates the text fields (transport types and cargo categories arrive as repeated fields; `GENERAL` is added if absent); `registrationProblem` from Task 2; `multer.memoryStorage()` with `limits.fileSize = MAX_DOCUMENT_BYTES` and exactly two named fields, its size error mapped to a 400 with a word message; Turnstile verified by `fetch` to `siteverify` with a 5 s timeout, skipped with one start-up warning when `TURNSTILE_SECRET` is unset; `applicationRateLimit` 5 per hour.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `render.yaml`: `TURNSTILE_SECRET` (`sync: false`).
- [ ] **Step 6: Commit** "Accept carrier applications".

### Task 6: Registry checks

**Files:**
- Create: `backend/src/services/registry/{registry.types,fmcsa,vies,index}.ts` + tests
- Modify: `onboarding.service.ts` (call after confirm), its test

**Interfaces:**
- Produces: `checkRegistry(application): Promise<{result: "FOUND" | "NOT_FOUND" | "UNAVAILABLE" | "MANUAL"; name?: string}>`; never throws.

- [ ] **Step 1: Failing tests** with an injected `fetch`: FMCSA found (name returned), not found, HTTP 500 → `UNAVAILABLE`, timeout → `UNAVAILABLE`, no `FMCSA_WEB_KEY` → `UNAVAILABLE` without calling; VIES valid, invalid, service fault; a manual country → `MANUAL` without calling; confirming an email stores the result.
- [ ] **Step 2–4:** FAIL → implement → PASS. Before coding, read the current FMCSA QCMobile and VIES REST documentation and record the exact endpoints and response fields in a comment; do not rely on memory.
- [ ] **Step 5:** `render.yaml`: `FMCSA_WEB_KEY` (`sync: false`).
- [ ] **Step 6: Commit** "Check applicants against FMCSA and VIES".

### Task 7: Admin API

**Files:**
- Create: `backend/src/controllers/admin.controller.ts`, `backend/src/routes/admin.routes.ts`, `backend/src/validators/admin.validator.ts`
- Modify: `onboarding.service.ts` + test, `app.ts` (mount `/api/admin` behind `authMiddleware` + `requireRole("ADMIN")`)

**Interfaces:**
- Consumes: `addCarrier` (Task 1), mail and tokens (Task 3), documents (Task 4).
- Produces: the seven admin routes of the spec; `approveApplication(id, adminId, now)`, `rejectApplication(id, adminId, reason, now)`, `recheckApplication(id)`.

- [ ] **Step 1: Failing tests**: list filters by status and returns counts; approve creates one carrier (name = trading name or legal name), stores `carrier_id`, writes the approval email with a set-password link; approving twice → second gets 409 and no second carrier; reject stores the reason and emails it; reject without a reason → 400; approve of an `EMAIL_PENDING` application → 409; a `MANAGER` or `CLIENT` cookie → 403 on every route; the document route answers with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- [ ] **Step 2–4:** FAIL → implement → PASS. The status change is a guarded `UPDATE ... WHERE status = 'PENDING_REVIEW' RETURNING`; the carrier is created only when that update returned a row.
- [ ] **Step 5: Commit** "Let the admin review carrier applications".

### Task 8: Set a password and open the account

**Files:**
- Modify: `onboarding.service.ts` + test, onboarding controller, routes, validator
- Modify: `backend/src/server.ts` or a small `onboarding.cleanup.ts` + test

**Interfaces:**
- Produces: `GET /api/onboarding/set-password/:token` → `{companyName, email}` | 410; `POST /api/onboarding/set-password` → creates the `MANAGER` via `createUserWithRole`, sets the session cookie, returns the user; `cleanUp(now)` deletes `EMAIL_PENDING` applications older than 48 h and the documents of applications rejected more than 30 days ago.

- [ ] **Step 1: Failing tests**: a valid token creates a manager whose `carrierId` is the approved carrier; the token cannot be used twice; expired after 7 days → 410; a weak password → 400 with the same rule as registration; `cleanUp` removes exactly the stale rows.
- [ ] **Step 2–4:** FAIL → implement → PASS. `cleanUp` runs at start and then once an hour (`setInterval(...).unref()`).
- [ ] **Step 5:** update the generated API docs / OpenAPI file if the project has one for the new routes (check `swagger-ui-express` usage).
- [ ] **Step 6: Commit** "Let an approved carrier set a password".

### Task 9: Role cards

**Files:**
- Create: `frontend/src/pages/signup/ChooseRolePage.tsx`, `frontend/src/pages/signup/RoleCard.tsx`, `frontend/src/pages/signup/illustrations/{ParcelArt,TruckArt}.tsx`, `frontend/src/pages/signup/CustomerSignupPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/pages/SignInPage.tsx`, `frontend/src/motion.css`, `frontend/src/components/Header.tsx`

**Interfaces:**
- Produces: routes `/signup`, `/signup/customer`; `SignInPage` becomes sign-in only with a "Create an account" link to `/signup`.

- [ ] **Step 1:** move the register form out of `SignInPage` into `CustomerSignupPage` unchanged in fields and behaviour.
- [ ] **Step 2:** `RoleCard` — a `RouterLink` styled as a card: illustration on top (about 160 px tall), title, one line, three short bullet points, "Continue →". Classes `stagger card-hover`.
- [ ] **Step 3:** illustrations as inline SVG in the palette (navy lines, aqua fills, red accent), built from named groups so CSS can move them. New motion classes: `art-drive` (truck translates about 14 px and back, wheels rotate), `art-slide` (parcel moves along the belt, belt dashes run). They play while the card is hovered or focused (`.role-card:hover .art-drive`, `:focus-visible`), and once on load. All under the reduced-motion switch-off block.
- [ ] **Step 4:** verify in the browser at 1360 px and 375 px: cards side by side then stacked, hover and keyboard focus both animate, Tab order is Customer then Carrier, reduced motion shows still pictures. Screenshot both widths.
- [ ] **Step 5: Commit** "Start sign-up with a choice of customer or carrier".

### Task 10: Carrier application form and email-link pages

**Files:**
- Create: `frontend/src/pages/signup/CarrierSignupPage.tsx`, `carrierForm.ts` + `carrierForm.test.ts`, `FileField.tsx`, `ConfirmEmailPage.tsx`, `SetPasswordPage.tsx`, `Turnstile.tsx`
- Modify: `frontend/src/api/api.ts`, `frontend/src/api/types.ts`, `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Task 2, 5, 8 endpoints.
- Produces: hooks `useOnboardingCountriesQuery`, `useSubmitApplicationMutation` (sends `FormData`; do not set `Content-Type`, the browser adds the boundary), `useConfirmEmailMutation`, `useSetPasswordInfoQuery`, `useSetPasswordMutation` (invalidates `Me`); `carrierForm.ts`: `formProblems(values, profile): Record<field, string | null>`, `fileProblem(file): string | null`, `formatBytes(n)`.

- [ ] **Step 1: Failing tests** for `formProblems` (each required field empty, phone with letters, no transport type) and `fileProblem` (not a PDF by type and by name, over 5 MB, fine).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** the page: three blocks (Company, Contact, What you carry and documents); country select drives the registration label and hint; `GENERAL` shown checked and locked; problems appear after the first submit attempt; API errors in an alert; success replaces the form with "Check your mailbox" naming the address. `Turnstile.tsx` loads the widget script only when `VITE_TURNSTILE_SITE_KEY` is set.
- [ ] **Step 6:** `ConfirmEmailPage` posts the token once on load (guard against React's double effect in development) and shows confirmed / expired. `SetPasswordPage` shows the company name, one password field, then navigates to `/console`.
- [ ] **Step 7:** verify in the browser with the local backend: submit with two small PDFs, open the confirm link taken from the backend's outbox, expired-token screen, phone width.
- [ ] **Step 8: Commit** "Let a carrier apply from the site".

### Task 11: Admin area

**Files:**
- Create: `frontend/src/admin/{AdminLayout,ApplicationsPage,ApplicationDetail,OutboxPage}.tsx`, `frontend/src/admin/access.ts` + test
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/api/{api,types}.ts`; extract the shared shell from `frontend/src/console/ConsoleLayout.tsx` only if it can be reused without changing console behaviour

**Interfaces:**
- Consumes: Task 7 endpoints.
- Produces: routes `/admin`, `/admin/applications/:id`, `/admin/outbox`; `adminAccess(me, error, isLoading)` with the same five results as `consoleAccess`; tag types `Applications`, `Outbox`.

- [ ] **Step 1: Failing tests** for `adminAccess`: loading, 401 → signin, 502 with no user → unavailable, `MANAGER` → forbidden, `ADMIN` → ok.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Applications: status tabs with counts, table (company, country, registry pill: FOUND `done`, NOT_FOUND `alert`, UNAVAILABLE / MANUAL `neutral`, submitted time), stored megabytes line. Detail: all fields, registry result with "Check again", two download buttons (plain links to the document route, so the browser saves the file), Approve, Reject with a dialog requiring the reason (`disableScrollLock`). Toast and row flash after a decision.
- [ ] **Step 6:** Outbox: to, subject, time, "Open link"; a banner "Emails are not being delivered. Open the link here or send it to the applicant yourself." unless the API reports delivery is on.
- [ ] **Step 7:** Header shows "Admin" for `ADMIN`. Verify in the browser as the seeded admin: approve one application, reject another, both emails appear in the Outbox.
- [ ] **Step 8: Commit** "Add the admin area for applications and the outbox".

### Task 12: Documentation and the full walk

**Files:**
- Modify: `docs/deploy-free.md`, `README.md`, `docs/study-notes.md`, `render.yaml` (final check)

- [ ] **Step 1:** `docs/deploy-free.md`, new section "Carrier onboarding", each with exact clicks and variable names:
  - **Turnstile**: create a widget in the Cloudflare dashboard for the site's hostname; site key → `VITE_TURNSTILE_SITE_KEY` in the Cloudflare build settings; secret → `TURNSTILE_SECRET` on Render; what happens when unset; the published test keys for local work.
  - **Real email (Resend)**: buy a domain, verify it in Resend (DNS records), set `RESEND_API_KEY` and `MAIL_FROM`; ⚠ without a domain only the owner's own address receives mail; the outbox keeps recording.
  - **Documents on R2**: why it is off (asks for a card), the 0.5 GB Neon limit and the roughly-50-applications estimate, the variables an R2 adapter needs (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), the one file to add (`services/documents/r2.store.ts`) and where it is chosen (`documents/index.ts`), and that old rows must be copied across.
  - **FMCSA key**: where to request the free web key; behaviour without it.
  - ⚠ single instance and the carrier cache; ⚠ upload size limits of the Worker and of Render.
- [ ] **Step 2:** README: the env table rows and a short "How a carrier joins" paragraph. `docs/deploy-aws.md`: one paragraph mapping the sockets to SES and S3.
- [ ] **Step 3:** study notes: why only token hashes are stored; why the submit answer is always the same; why files are checked by their first bytes; why the user is created at set-password and not at approval.
- [ ] **Step 4:** `cd backend && npm test`; `cd frontend && npm test && npm run build && npm run lint` → all pass.
- [ ] **Step 5:** full walk on a local copy with Docker Postgres: apply → Outbox → confirm → approve → set password → console → create a tariff → as a client get a quote that includes the new carrier → restart the backend → the carrier and its tariff are still there. Then the reject path, an expired link, 375 px and reduced motion.
- [ ] **Step 6: Commit** "Document carrier onboarding".
