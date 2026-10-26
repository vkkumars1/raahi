# Raahi backend

Verified-commuter carpooling for Indian cities. This folder holds everything except the Next.js frontend:

```
raahi/
├── (your Next.js app, on Vercel)
├── api/                 Express + TypeScript, PostgreSQL/PostGIS, Redis, Socket.io   -> Render
├── ai-service/          FastAPI assistant (Groq Llama, tool calling)                 -> Render
├── scripts/keep-alive.mjs
├── .github/workflows/   ci.yml, keep-alive.yml
├── render.yaml          Render blueprint (both services)
└── docker-compose.yml   full local stack
```

```
Next.js (Vercel, SSR) ──REST──► Express API ──► PostgreSQL + PostGIS (Neon)
        │                          │  ├──────► Redis (OTP, rate limits)  (Upstash)
        └──── Socket.io ───────────┘  └──────► FastAPI AI service ──► Groq (Llama 3)
```

## The interesting engineering

| Problem | Solution | Where |
|---|---|---|
| Match riders to hosts by route overlap | PostGIS `ST_DWithin` (GiST index) for proximity, `ST_LineLocatePoint` so pickup comes *before* drop in the direction of travel, time window filter | `api/src/repositories/rides.repo.ts` |
| Fair fares | Guest pays only for their segment, cut with `ST_LineSubstring`, priced per km, min Rs 10 | `rides.repo.ts`, `lib/geo.ts` |
| Two people booking the last seat | Transaction + `SELECT ... FOR UPDATE` row lock. Tested: 5 parallel bookings, exactly 1 wins, 4 get `409 no_seats` | `services/booking.service.ts`, `tests/e2e.test.ts` |
| Secure OTP | 6-digit code, only an HMAC-SHA256 hash is stored in Redis with 5 min TTL, 5 attempts, 30 s resend cooldown, 5 requests/hour/email, single use, constant-time compare | `services/auth.service.ts` |
| Realtime chat | Socket.io, handshake auth, room join verified against the DB (host + confirmed guests only), flood guard, persisted messages | `sockets/chat.ts` |
| Free-tier cold starts | Keep-warm pings, plus the AI service is woken on demand by `/ai/warmup` so it does not eat the 750 free hours | `scripts/`, `routes/misc.routes.ts` |

Layered architecture: `routes (validation, HTTP) -> services (business rules) -> repositories (SQL)`.

## Run locally

```bash
# 1. everything in Docker
docker compose up --build            # API :4000, AI :8000, Postgres :5432, Redis :6379

# 2. or just the API
cd api && cp .env.example .env       # fill DATABASE_URL (needs PostGIS)
npm install
npm run migrate
npm run dev
```
With no `SMTP_HOST` set, the OTP is printed in the API log (development only). With no `REDIS_URL` an in-memory store is used (development only).

Tests (need a PostGIS database; they skip the DB suites if none is reachable):
```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/raahi_test npm test   # 23 tests
cd ../ai-service && pip install -r requirements.txt pytest && pytest -q
```

## Deploy (all free tiers)

1. **Neon**: create a project and copy the connection string -> `DATABASE_URL`. The migration enables PostGIS and citext itself.
2. **Upstash Redis**: create a database, copy the `rediss://` URL -> `REDIS_URL`.
3. **SMTP** for OTP emails: any provider with a free tier (Brevo, or Gmail with an app password). Set `SMTP_*` and `MAIL_FROM`.
4. **Groq**: create a free API key -> `GROQ_API_KEY` (AI service).
5. **Render**: New -> Blueprint -> this repo (uses `render.yaml`). Fill the secrets. Set `FRONTEND_URL` to your Vercel URL and `AI_SERVICE_URL` / `API_URL` to the two Render URLs.
6. **Vercel**: set `NEXT_PUBLIC_API_URL` to the Render API URL. See `FRONTEND_INTEGRATION.md`.
7. **GitHub**: Settings -> Secrets and variables -> Actions -> add `BACKEND_URL` and `FRONTEND_URL` for the keep-alive workflow.

## Keep-alive

`.github/workflows/keep-alive.yml` runs `scripts/keep-alive.mjs`:
- **warm**, every 10 min between 03:00 and 18:59 UTC (08:30 AM to 12:29 AM IST): `GET /health`. Render sleeps free services after 15 minutes without traffic, so a once-a-day ping alone cannot keep it awake.
- **deep**, once a day: `GET /health/deep` runs `SELECT 1` and `PING` so Neon and Upstash always see recent activity.
- Only the API is kept warm. Free instances share 750 hours per month per Render workspace, and one service running 24x7 uses about 744 of them. The AI service sleeps when idle and is woken by `POST /ai/warmup` when the user opens the chatbot.
- Vercel never sleeps (serverless), so its ping only warms a cold start.
- Run it by hand before sharing your resume: Actions -> Keep Raahi awake -> Run workflow.
- GitHub disables scheduled workflows in a public repo after 60 days without repository activity. Push a commit now and then, or add a free external monitor (UptimeRobot / cron-job.org) on `/health` as a second pinger.

## API reference

JSON everywhere. Errors: `{ "error": "message", "code": "machine_code", ... }`. Auth: `Authorization: Bearer <jwt>` or the `raahi_token` httpOnly cookie.

| Method & path | Auth | Body / query | Response |
|---|---|---|---|
| `POST /auth/request-otp` | - | `{email}` | `{ok, expiresInSeconds, cooldownSeconds}` (429 + `retryAfter`) |
| `POST /auth/verify-otp` | - | `{email, code}` | `{token, user, isNewUser}` + cookie |
| `POST /auth/socket-token` | yes | - | `{token}` valid 5 min, for socket.io handshake |
| `POST /auth/logout` | - | - | `{ok}` |
| `GET /me` | yes | - | `{user}` |
| `PUT /me` | yes | `{name, role, vehicleType?, officeLocation?}` | `{user}` |
| `POST /rides` | yes | `{origin, destination, routeGeoJSON, departTime, seats, pricePerKm, vehicleType?}` | `201 {ride}` |
| `GET /rides/search` | optional | `pickupLat, pickupLng, dropLat, dropLng, time, windowMinutes?` | `{results:[{ride, matchPercent, fare, segmentKm, detourKm, minutesApart}], count}` |
| `GET /rides/mine` | yes | - | `{rides:[ride + bookings[]]}` |
| `GET /rides/:id` | optional | - | `{ride, isHost?, myBooking?, participants?}` |
| `POST /rides/:id/book` | yes | `{pickup:{label,lat,lng}, drop:{label,lat,lng}}` | `201 {booking}`; 409 `no_seats` / `already_booked` / `ride_closed`; 400 `off_route` / `wrong_direction` |
| `POST /rides/:id/complete` | host | - | `{ride}` |
| `GET /rides/:id/messages` | member | - | `{messages}` |
| `GET /bookings/mine` | yes | - | `{bookings:[booking + ride + rated]}` |
| `POST /ratings` | yes | `{rideId, rating 1-5, comment?, rateeId?}` | `201 {rating}` |
| `GET /dashboard/stats` | yes | - | `{moneySaved, moneyEarned, co2SavedKg, ridesShared, avgRating, trustScore, monthly[6]}` |
| `POST /ai/warmup` | - | - | `202` |
| `POST /ai/chat` | optional | `{messages:[{role, content}]}` | streamed text; may end with a fenced ```json {"type":"rides",...} block |
| `GET /health`, `GET /health/deep` | - | - | status |

Socket.io events: client `join_ride {rideId}` (ack `{ok}`), `message {rideId, body}` (ack `{ok, message}`), `typing {rideId, isTyping}`; server `message`, `typing`.

Coordinates in GeoJSON are `[lng, lat]`. Ride objects return `route` simplified to about 5 m.

## Interview talking points

- *Why PostGIS instead of computing distances in Node?* Index-backed spatial predicates, and direction-aware matching (`ST_LineLocatePoint`) is a one-liner in SQL.
- *How do you stop overbooking?* Row lock inside a transaction; show the concurrent test.
- *Why HMAC instead of storing the OTP?* A Redis leak should not leak valid codes; the pepper lives only in the API env.
- *Why a separate AI service?* Different runtime and scaling profile, can sleep independently, isolates the LLM key; Express proxies and streams.
- *What would you do at scale?* Redis-backed Socket.io adapter, queue emails, partition rides by city/date, cache searches, read replicas.
