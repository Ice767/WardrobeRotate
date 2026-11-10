# Study notes: details to understand in depth later

Short explanations are given while working; this list keeps the small points
that are worth learning properly, so they can be explained to others. Each item
names the file to read.

## Security

- **Why `SameSite=Lax` protects against CSRF**, and why it only works because the
  site and `/api` share one origin. `backend/src/utils/cookie.helper.ts`
- **Why CORS must never allow `*` with credentials.** `backend/src/config/cors.config.ts`
- **JWT `alg` pinning**: why the algorithm comes from code, not from the token header;
  why a `type: "access"` claim is checked. `backend/src/services/token.service.ts`
- **X-Forwarded-For and `trust proxy`**: how Express picks the client IP from the
  right end of the list, why `TRUST_PROXY=2`, and how a forged header is defeated
  by the proxy overwriting it and by `PROXY_SECRET`. `backend/src/app.ts`,
  `frontend/worker.js`, `backend/src/middlewares/proxy.middleware.ts`
- **`timingSafeEqual` and why the values are hashed first.** `backend/src/middlewares/proxy.middleware.ts`
- **Rate limiting that counts only failures** (`skipSuccessfulRequests`) and why the
  limiter runs before validation. `backend/src/middlewares/rate-limit.middleware.ts`
- **http-errors `expose` flag**: why parser errors become 400/413, and why their
  message is replaced. `backend/src/middlewares/error.middleware.ts`

## Data and concurrency

- **Race conditions closed by the database**: `UNIQUE` constraints, a transaction that
  only closes an `OPEN` RFQ, `UPDATE ... WHERE status = $expected`.
  `backend/src/repositories/postgres.ts`
- **Why a check in code ("does it exist?") is not enough** when two requests run at
  once. `backend/src/services/auth.service.ts`, `shipment.service.ts`
- **One repository interface, two implementations, one contract test.**
  `backend/src/repositories/repositories.contract.test.ts`
- **Money in integer cents, one `Math.ceil` at the end.** `backend/src/services/price.calculator.ts`

## Frontend

- **Why RTK Query keeps old `data` after a failed refetch**, and why only a 401 clears
  the signed-in user while a 502 does not. `frontend/src/lib/session.ts`
- **Why `StyledEngineProvider injectFirst` is needed**: two CSS rules of equal weight are
  decided by their order in the page, so MUI has to load before `motion.css`.
  `frontend/src/main.tsx`
- **Why a scrollbar moves centered content**, how `scrollbar-gutter: stable` prevents it,
  and why the MUI scroll lock then has to be switched off. `frontend/src/theme.ts`
- **Why the console's search filters loaded data instead of calling the server**: the
  menu counters already load every tariff, request and shipment, so filtering them in
  the browser is instant and needs no new endpoint. It stops being right once a carrier
  has more rows than one request should return. `frontend/src/console/search.ts`

## Deployment

- **What a Worker with static assets is** and why the proxy keeps the cookie first-party.
  `docs/deploy-free.md`
- **`npm ci` vs `npm install`.** `backend/Dockerfile`
- **Why `NODE_ENV=production` skips devDependencies in `npm ci`**, and why the Render
  build needs `--include=dev` (build and runtime share one environment). `render.yaml`
- **Why a sleeping Render backend looks like "no cities"**, why only GET is retried
  (a repeated POST could book twice), and how the cron keeps it awake within the
  750 free hours a month. `frontend/worker.js`, `frontend/wrangler.jsonc`
- **`sslmode=require` vs `verify-full`** in the Postgres connection string.
- **Connection pool size vs Neon limits.** `backend/src/repositories/postgres.ts`
