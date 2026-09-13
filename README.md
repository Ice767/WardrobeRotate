# Freight Marketplace

A logistics marketplace: a shipper describes a shipment — route, weight, volume,
transport type — and gets competing quotes from several carriers, then books
one and tracks it to delivery. Carriers publish their own rates; the platform
prices a shipment against them.

> The repository is still named `WardrobeRotate` after an earlier idea that was
> dropped. The code here is the freight marketplace described above.

**Status:** backend in progress. Authentication and reference data are done; the
tariff matrix, the price calculator and search are not written yet. The frontend
is scaffolded (Vite + React 19) but `frontend/src` is empty, so only the backend
runs today.

## Quick start

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3100
```

The server seeds itself on every boot and refuses to start if seeding fails.
Seeded admin: `admin@logistics.dev` / `AdminPass123!` (override the password with
`SEED_ADMIN_PASSWORD`). All data lives in process memory and is gone on restart.

```bash
cd backend && npm test    # tsc + node --test; no test files yet, so 0 tests
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
  `pricePerKg`, `pricePerM3`, `minCharge`, `transitDays`. *Not built yet.*
- **Surcharge** — fuel, hazmat, oversize, insurance. Separate from tariffs
  because it changes far more often. *Not built yet.*
- **Shipment** — `DRAFT → CONFIRMED → PICKED_UP → IN_TRANSIT → DELIVERED`, or
  `CANCELLED`. *Not built yet.*

### Roles

| Role | Can |
| --- | --- |
| `CLIENT` | request quotes, book shipments |
| `MANAGER` | manage tariffs for the one carrier named by their `carrierId` |
| `ADMIN` | everything, including creating managers |

Registration always issues `CLIENT` — the role cannot be set through the request
body. `MANAGER` and `ADMIN` accounts are created server-side only.

### Pricing (planned)

```
volumetricWeight = volumeM3 x volumetricFactorKgPerM3   // 167 air, 250 truck, 1000 sea
chargeableWeight = max(actualWeight, volumetricWeight)
base             = max(chargeableWeight x pricePerKg, minCharge)
total            = base + percentage surcharges + flat surcharges
```

Light bulky freight is charged by the space it occupies, not by the scale. This
calculator is the centerpiece of the project and will be a pure, unit-tested
function.

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
- No AWS Lambda or gateway layer; a deployment guide comes once there is
  something substantial to deploy.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3100` | HTTP port |
| `NODE_ENV` | `development` | drives cookie `secure` / `sameSite` |
| `LOG_LEVEL` | `info` | pino level |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | comma-separated CORS allowlist; the origin is echoed back, never `*`, because the cookie is credentialed |
| `JWT_ACCESS_SECRET` | — | required; the server will not start without it |
| `JWT_ACCESS_TTL` | `1d` | also determines the cookie's lifetime |
| `SEED_ADMIN_PASSWORD` | `AdminPass123!` | password for the seeded admin |
