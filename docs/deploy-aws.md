# Deploying Freight Market to AWS

This guide takes the app from a laptop to AWS in three phases. Read the first
section before anything else: the backend as it stands cannot simply be
scaled out, and the order of the phases follows from that.

| Phase | What you get | Blocked by |
| --- | --- | --- |
| 1. Demo | Public HTTPS site, real backend, data lost on every restart | nothing — works with today's code |
| 2. Production | Durable data, more than one server, secrets managed | replacing the in-memory store (code work) |
| 3. Notifications | Email and SMS on shipment events | phase 2, plus a notification module (code work) |

## Why the order matters

`backend/src/data/store.ts` keeps every user, tariff, RFQ and shipment in
process memory. That has two consequences on AWS:

- **One process only.** Two servers would each hold different data; a user
  registered on one would not exist on the other. Lambda is worse: every cold
  start begins empty.
- **Every restart wipes everything** except the seeded reference data and the
  seeded admin. Elastic Beanstalk restarts the process on every deploy and when
  it replaces an unhealthy instance.

So phase 1 runs exactly one instance and is fit for a demo, not for customers.

## Before you start

1. **An AWS account with a budget alarm.** Billing → Budgets → create a monthly
   cost budget (for example $30) with an email alert at 80 %. Do this first; the
   load balancer in phase 1 bills by the hour whether or not anyone visits.
2. **A region.** `eu-central-1` (Frankfurt) is a reasonable middle point for
   US, Israel and Russia traffic and has every service used here. `il-central-1`
   (Tel Aviv) exists too; check that each service below is offered there before
   choosing it.
3. **A domain** you control, for example `freightmarket.example`. Route 53 can
   host it, or keep your registrar and add records there.
4. **Tools:** AWS CLI v2 (`aws configure`), the Elastic Beanstalk CLI
   (`pip install awsebcli`), Node.js 22.

## Phase 1 — Demo

```
Browser ──► Amplify Hosting (frontend, CloudFront)
               │  /api/*  reverse-proxied, same origin
               ▼
            Application Load Balancer (HTTPS, ACM certificate)
               ▼
            Elastic Beanstalk, Node.js 22, exactly 1 instance
```

### Why this shape

- **Same origin for the API.** The auth token lives in an httpOnly cookie.
  Served from one domain, that cookie is first-party and browsers keep it;
  served cross-site, Safari and others increasingly drop it. Amplify's reverse
  proxy rewrite keeps `/api` on the frontend's own domain, exactly as Vite does
  in development.
- **Elastic Beanstalk, one instance.** It runs the Express app unchanged. A load
  balancer in front, even for one instance, gives HTTPS through ACM without
  managing certificates on the server.

### 1.1 Backend on Elastic Beanstalk

Build locally and ship the compiled output. `dist/` is git-ignored, so an
`.ebignore` file tells the EB CLI what to upload instead of using git:

```bash
cd backend
npm ci
npm run build
```

Create `backend/.ebignore`:

```
node_modules/
src/
.env
*.test.js
```

`.env` must stay out of the bundle — it holds the local JWT secret.

```bash
eb init freight-api --platform node.js-22 --region eu-central-1
eb create freight-api-demo --elb-type application --instance_type t3.small --scale 1
```

Set the configuration. Generate a long random secret; never reuse the local one.

```bash
eb setenv NODE_ENV=production \
  JWT_ACCESS_SECRET="$(openssl rand -hex 48)" \
  JWT_ACCESS_TTL=1d \
  SEED_ADMIN_PASSWORD="<a strong password you store in a password manager>" \
  ALLOWED_ORIGINS="https://app.freightmarket.example"
```

> ⚠ `SEED_ADMIN_PASSWORD` is not optional here. Without it the admin is created
> with `AdminPass123!`, which is written in the public README.

Elastic Beanstalk sets `PORT=8080` and proxies to it; `server.ts` already reads
`PORT`. It runs `npm start`, which starts `dist/server.js`. Check it is up:

```bash
eb status
curl http://<the CNAME from eb status>/api/health
```

Turn on log streaming: EB console → Configuration → Updates, monitoring and
logging → Instance log streaming to CloudWatch Logs. pino writes JSON to stdout,
so CloudWatch Logs Insights can query fields such as `level` and `correlationId`
without further setup.

### 1.2 HTTPS for the API

1. ACM (in the same region as the environment) → request a public certificate
   for `api.freightmarket.example`, validate by DNS.
2. EB console → Configuration → Load balancer → add a listener on port 443,
   protocol HTTPS, with that certificate.
3. DNS: `api.freightmarket.example` → CNAME (or Route 53 alias) to the
   environment's CNAME.
4. `curl https://api.freightmarket.example/api/health` returns `{"status":"OK"}`.

### 1.3 Frontend on Amplify Hosting

1. Amplify console → Create new app → GitHub → `Ice767/WardrobeRotate`, the
   branch to deploy. Tick **"My app is a monorepo"** and set the root to
   `frontend`.
2. Amplify detects Vite. If it asks for build settings, use:

   ```yaml
   version: 1
   applications:
     - appRoot: frontend
       frontend:
         phases:
           preBuild:
             commands:
               - npm ci
           build:
             commands:
               - npm run build
         artifacts:
           baseDirectory: dist
           files:
             - '**/*'
         cache:
           paths:
             - node_modules/**/*
   ```

   The environment variable `AMPLIFY_MONOREPO_APP_ROOT=frontend` must be set;
   the console adds it when you tick the monorepo box.
3. Hosting → Rewrites and redirects → edit as JSON. Order matters — the API rule
   comes first:

   ```json
   [
     {
       "source": "/api/<*>",
       "target": "https://api.freightmarket.example/api/<*>",
       "status": "200",
       "condition": null
     },
     {
       "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
       "target": "/index.html",
       "status": "200",
       "condition": null
     }
   ]
   ```

   The first is a reverse proxy (`200`, not a redirect), so the browser never
   leaves the frontend's domain. The second sends deep links such as
   `/track/FM-6FFZNQWE` to the React app instead of a 404.
4. Custom domain: Amplify → Hosting → Custom domains → add
   `app.freightmarket.example`. Amplify issues the certificate itself.

### 1.4 Check the whole path

1. Open `https://app.freightmarket.example`, price Ashdod → Houston, 2000 kg,
   20 m³: two offers appear.
2. Create an account, book, open the tracking link.
3. Browser dev tools → Application → Cookies: `accessToken` is set on
   `app.freightmarket.example`, `HttpOnly` and `Secure`.

If the cookie does not arrive, the proxy is not passing `Set-Cookie` through.
The fallback is a CloudFront distribution you configure yourself, with the
Amplify or S3 site as the default origin and the load balancer as the origin
for the `/api/*` behaviour (caching disabled, all cookies and headers
forwarded). Same principle, more knobs.

### 1.5 Deploying changes

- Frontend: push to the connected branch; Amplify builds it.
- Backend: `npm run build && eb deploy` from `backend/`. Every deploy restarts
  the process and wipes the in-memory data.

## Phase 2 — Production

### 2.1 Code work first

| Task | Where | What changes |
| --- | --- | --- |
| Replace the store | `data/store.ts` and the services that touch its Maps | DynamoDB tables (or Postgres on RDS). The services were written against this one module so that only it changes |
| Uniqueness | users by email, tariff lanes, tracking codes, one shipment per RFQ | DynamoDB conditional writes (`attribute_not_exists`) on a dedicated key item; or `UNIQUE` constraints in Postgres |
| Atomic multi-record writes | `rfq.service.ts` `acceptQuote`, `cancelRfq` | `TransactWriteItems` (DynamoDB) or a transaction (Postgres); today two concurrent accepts could both succeed |
| Optimistic status changes | `shipment.service.ts` `changeStatus`, `rfq.service.ts` `refreshStatus` | conditional write "only if status is still X" |
| Lists without scans | `listRfqs`, `listShipments`, `listTariffs` | DynamoDB GSIs by client and by carrier; RFQ invitations become one item per `rfqId + carrierId`, because a list attribute cannot be indexed |
| Seeding | `data/seed.ts` runs on every boot | a one-off migration script run at deploy time |
| Secrets | `config/jwt.config.ts` reads an env var | load from Secrets Manager or SSM Parameter Store at startup; the getter already isolates the read |

A DynamoDB starting point, one table per entity for readability:

| Table | Partition key | Indexes |
| --- | --- | --- |
| users | `userId` | GSI `email` (plus a uniqueness item `EMAIL#<email>`) |
| tariffs | `tariffId` | GSI `laneKey` (`carrier|from|to|type`), GSI `carrierId` |
| rfqs | `rfqId` | GSI `clientId` |
| rfqInvites | `carrierId` + sort `rfqId` | — |
| rfqQuotes | `rfqId` + sort `carrierId` | — |
| shipments | `shipmentId` | GSI `clientId`, GSI `carrierId`, GSI `trackingCode` |

Turn on point-in-time recovery for every table.

### 2.2 Infrastructure

- **Compute.** With durable storage, either raise Elastic Beanstalk to
  min 2 / max 4 instances across two availability zones, or move the API to
  Lambda behind API Gateway (HTTP API). Express runs on Lambda through the AWS
  Lambda Web Adapter or the `serverless-http` wrapper. Elastic Beanstalk is the
  smaller step from phase 1; Lambda costs less at low and spiky traffic.
- **IAM.** The instance profile (or Lambda role) gets only what the app uses:
  read/write on its own tables, `secretsmanager:GetSecretValue` on its one
  secret, and later `ses:SendEmail` and SMS publish.
- **Alarms.** CloudWatch alarms on load balancer 5xx count and target response
  time, and on DynamoDB throttled requests.
- **Deploy from CI.** GitHub Actions running `npm test` in both packages on every
  pull request; deploy only from `main`.

## Phase 3 — Email and SMS notifications

### 3.1 What to notify

| Event | Who | Channel |
| --- | --- | --- |
| RFQ filed | each invited carrier's managers | email |
| Carrier answered an RFQ | client | email, optional SMS |
| Shipment booked | carrier | email |
| Picked up, in transit, delivered | client | SMS and email |

### 3.2 Code work

- Users get an optional `phone` in E.164 form (`+972…`, `+1…`) and an explicit
  SMS opt-in flag. Sending SMS without opt-in breaks carrier rules in the US
  and is illegal in many countries.
- A `notification.service.ts` called from `changeStatus` and the RFQ service.
  Put the message on an SQS queue and send from a worker (a small Lambda), so a
  slow or failing SMS provider never fails or delays a status change.
- Message text stays free of contents and price, matching what public tracking
  shows: an SMS can be read on a lock screen.

### 3.3 Email with Amazon SES

1. SES → Verified identities → verify `freightmarket.example` with Easy DKIM
   (the console gives the DNS records). Add SPF and a DMARC record as well.
2. New accounts start in the SES sandbox: mail only to verified addresses, with
   a low daily quota. Request production access from the SES console, describing
   the transactional use and how bounces are handled.
3. Route bounce and complaint notifications to SNS, and stop emailing addresses
   that hard-bounce.

### 3.4 SMS with AWS End User Messaging

AWS End User Messaging SMS (formerly Amazon Pinpoint SMS) is the service for
transactional SMS; Amazon SNS can also publish SMS and uses the same
underlying capability.

1. The account starts in the SMS sandbox: messages go only to verified
   destination numbers. Request production access in the console.
2. Get an **origination identity** for each country you send to. Rules differ:
   - **United States:** a registered toll-free number or 10DLC campaign is
     required for application-to-person traffic. Registration takes days to
     weeks; start early.
   - **Israel and Russia:** check the country's entry in the End User Messaging
     SMS documentation before sending. Some countries require a pre-registered
     sender ID, and delivery to some destinations can be restricted.
3. Set a monthly spend limit you are comfortable with. Accounts start with a
   very low limit; raising it is a quota request.
4. Mark messages as transactional, not promotional.

## Quick reference

| Concern | Service | Phase |
| --- | --- | --- |
| Frontend hosting, CDN, TLS | Amplify Hosting | 1 |
| API runtime | Elastic Beanstalk (later optionally Lambda + API Gateway) | 1 |
| TLS for the API | ACM on the load balancer | 1 |
| DNS | Route 53 or your registrar | 1 |
| Logs | CloudWatch Logs | 1 |
| Cost guard | AWS Budgets | before 1 |
| Database | DynamoDB (or RDS Postgres) | 2 |
| Secrets | Secrets Manager / SSM Parameter Store | 2 |
| Alarms | CloudWatch alarms | 2 |
| Email | SES | 3 |
| SMS | AWS End User Messaging SMS | 3 |
| Async sending | SQS + Lambda | 3 |
