# Freight Marketplace

A logistics marketplace: a shipper describes a shipment — route, weight, volume,
transport type — and gets competing quotes from several carriers, then books
one and tracks it to delivery. Carriers publish their own rates; the platform
prices a shipment against them.

> The repository is still named `WardrobeRotate` after an earlier idea that was
> dropped. The code here is the freight marketplace described above.

**Status:** the client journey works end to end — price a shipment, request
firm prices for special cargo, accept a quote, book, track. Carriers have a
complete API but no screens yet. Data lives in process memory, so this is not
yet deployable beyond a single demo server; see [docs/deploy-aws.md](docs/deploy-aws.md).

## Quick start

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3100
```

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to the backend
```

The server seeds itself on every boot and refuses to start if seeding fails.
Seeded admin: `admin@logistics.dev` / `AdminPass123!` in development. With
`NODE_ENV=production` there is no default: the server refuses to start until
`SEED_ADMIN_PASSWORD` is set. All data lives in
process memory and is gone on restart.

```bash
cd backend && npm test     # tsc + node --test
cd frontend && npm test    # vitest
```

## API

Reference data is public; everything else expects the auth cookie.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | liveness |
| `POST` | `/api/auth/register` | always creates a `CLIENT`; sets the auth cookie |
| `POST` | `/api/auth/login` | sets the auth cookie |
| `POST` | `/api/auth/logout` | clears it |
| `GET` | `/api/auth/me` | current user, read from the store rather than the token |
| `GET` | `/api/regions` | filters: `?level=`, `?parentId=` |
| `GET` | `/api/regions/:regionId` | the region plus its `path` up to the country |
| `GET` | `/api/transport-types` | limits and volumetric factors per type |
| `GET` | `/api/carriers` | filter: `?transportType=` |
| `GET` | `/api/carriers/:carrierId` | |
| `GET` | `/api/cargo-categories` | pricing mode per category: instant, indicative range, on request |
| `POST` | `/api/quotes` | public; offers from every eligible carrier |
| `POST` | `/api/users` | `ADMIN`; creates managers bound to a carrier |
| `GET` `POST` | `/api/tariffs` | `MANAGER` (own carrier only) and `ADMIN` |
| `GET` `PATCH` `DELETE` | `/api/tariffs/:tariffId` | lane is immutable; a competitor's tariff answers 404 |
| `GET` `POST` | `/api/rfqs` | requests for firm prices; `CLIENT` files them |
| `POST` | `/api/rfqs/:rfqId/quotes` | invited carrier's `MANAGER` answers |
| `POST` | `/api/rfqs/:rfqId/accept` · `cancel` | the filing `CLIENT` |
| `GET` `POST` | `/api/shipments` | `CLIENT` books from an instant offer or an accepted RFQ |
| `POST` | `/api/shipments/:shipmentId/status` | allowed moves come from the transition table |
| `GET` | `/api/track/:trackingCode` | public; route and timeline only |

Every response is wrapped in an envelope carrying a `correlationId`:

```json
{
  "success": true,
  "meta": {"correlationId": "...", "status": "SUCCESS", "timestamp": "..."},
  "data": {}
}
```

## Domain

- **Region** — a hierarchy of uneven depth (`COUNTRY` → `DISTRICT` → `REGION` →
  `CITY`, with levels skipped where reality skips them). Seeded for the US,
  Israel and Russia, because the platform is meant to quote Tel Aviv → Chicago,
  not only domestic lanes. A tariff can therefore be set as narrowly as one city
  or as broadly as a federal district, and lookup walks up `parentId` from
  specific to general.
- **TransportType** — `TRUCK` / `RAIL` / `AIR` / `SEA` / `LTL`, each with a weight
  ceiling, a volume ceiling and a volumetric factor. Industry convention rather
  than data, so it is a frozen constant in code and not editable through the API.
- **Carrier** — a shipping company. Search returns competing offers from several.
- **Tariff** — the core matrix: `(carrier, from, to, transportType)` →
  `pricePerKgCents`, `pricePerM3Cents`, `minChargeCents`, `transitDays`. Money is
  integer cents throughout.
- **Cargo category** — general, dangerous, temperature-controlled, oversized,
  valuables, live animals, after IATA special handling codes. Decides whether a
  client sees an exact price, a range, or "on request".
- **RFQ** — a request for firm prices, sent to every eligible carrier; each
  answers once, the client accepts one.
- **Shipment** — `CONFIRMED → PICKED_UP → IN_TRANSIT → DELIVERED`, or `CANCELLED`
  before pickup. Price frozen at booking; public tracking by code.
- **Surcharge** — fuel, hazmat, oversize, insurance. *Not built yet*; special
  cargo is priced through ranges and RFQs instead.

### Roles

| Role | Can |
| --- | --- |
| `CLIENT` | price shipments, file and accept RFQs, book, cancel before pickup |
| `MANAGER` | for the one carrier named by their `carrierId`: tariffs, RFQ answers, shipment progress |
| `ADMIN` | everything, including creating managers |

Registration always issues `CLIENT` — the role cannot be set through the request
body. `MANAGER` and `ADMIN` accounts are created server-side only.

### Pricing

```
volumetricWeight = volumeM3 x volumetricFactorKgPerM3   // 167 air, 250 truck, 1000 sea
chargeableWeight = max(actualWeight, volumetricWeight)
freight          = max(chargeableWeight x pricePerKg, volumeM3 x pricePerM3)
total            = ceil(max(freight, minCharge))         // rounded once, upward
```

Light bulky freight is charged by the space it occupies, not by the scale. The
calculator is a pure function in `services/price.calculator.ts`; the narrowest
matching lane wins, even when a broader one is cheaper.

## Implementation notes

- **Storage is in-memory.** `data/store.ts` holds plain `Map`s. When a real
  database arrives, that module is what gets replaced — the services should not
  have to change.
- **Seed ids are deterministic.** `utils/stable-id.ts` derives a UUID v5 from a
  slug instead of generating a random one, so region and carrier ids survive a
  restart. Seeds only — records created through the API use `randomUUID`.
- **Seeds are validated at startup.** A duplicate slug or a `parentSlug` pointing
  nowhere aborts the boot rather than silently losing a region.
- **Zod validators are the only place external input is trusted.** Unknown enum
  values are rejected with a 400 listing what is allowed, rather than quietly
  returning an empty result.
- **Layering.** `routes → controllers → services → data`; contracts hold the
  shared types, and `toPublicUser` is the single place a stored user becomes a
  response, so `passwordHash` cannot leak by omission.

## Deliberate simplifications

- No refresh token — one JWT access token in an httpOnly cookie, 1 day TTL.
- No password reset by email.
- No generated OpenAPI/Swagger documentation.
- No persistent database yet; [docs/deploy-aws.md](docs/deploy-aws.md) covers
  what has to change before production.
- No carrier or admin screens; their API is complete.
- No email or SMS notifications.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3100` | HTTP port |
| `NODE_ENV` | `development` | `production` sets the cookie `secure` and requires `SEED_ADMIN_PASSWORD` |
| `LOG_LEVEL` | `info` | pino level |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | comma-separated CORS allowlist; the origin is echoed back, never `*`, because the cookie is credentialed |
| `JWT_ACCESS_SECRET` | — | required; the server will not start without it |
| `JWT_ACCESS_TTL` | `1d` | also determines the cookie's lifetime |
| `SEED_ADMIN_PASSWORD` | `AdminPass123!` outside production | password for the seeded admin; required in production |
