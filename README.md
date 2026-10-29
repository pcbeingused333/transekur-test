# "Driver 10 minutes away" notice

Mini standalone version of the feature, built for the Transekur practical test. All data is made up.

**Live demo:** https://transekur-test-two.vercel.app

| Role | Email | Password |
|---|---|---|
| Dispatch | `dispatch@transekur.test` | `demo1234` |
| Driver (Carlos) | `carlos@transekur.test` | `demo1234` |
| Driver (María) | `maria@transekur.test` | `demo1234` |

## Try it (2 minutes)

1. Log in as **dispatch**. If the list looks empty or old, press **Cargar servicios de ejemplo para hoy**.
2. Create a service for **today**, assign Carlos. (Drivers only see today's services, by design.)
3. On a phone (or a private window), log in as **Carlos**. He sees only his own services.
4. Tap **A 10 min**. The button becomes "Aviso enviado a las HH:MM".
5. Back on dispatch (it refreshes every 10 s): the notice shows the time it went out, the simulated SMS with driver name and vehicle, and a WhatsApp link with the message prefilled.

## What it does

- **Dispatch screen** (`/dispatch`): create a service (client, phone, date/time, pickup point), assign a driver, see every service and whether its notice went out and when.
- **Driver app** (`/driver`, mobile web): login, today's own services only, one big button.
- **Client notice**: message with the driver's name and vehicle, stored with its send time. Shown on dispatch as a simulated SMS plus a `wa.me` link. No real sending.

Extras: one notice per service enforced by the database (a double tap does nothing), auto-refresh on dispatch, a button that recreates the demo services for today.

## Assumptions

- One driver and one vehicle per service; the vehicle belongs to the driver.
- Times are Santo Domingo time (`America/Santo_Domingo`, UTC-4, no DST), stored as UTC.
- "Today" means today in Santo Domingo, not in the server's zone.
- Message is in Spanish and fixed (see `lib/format.ts`).
- Simple email + password login with a signed cookie. Enough for a demo.

## Out of scope

Real SMS/WhatsApp sending, GPS or ETA, iLimo integration, payments, client portal, roles beyond dispatch and driver, editing or cancelling a service, reassigning a driver, availability checks.

## How the real notice would work

The tap already stores the notice in `notices`, which would act as an outbox. A provider (Twilio SMS, or the WhatsApp Business API) sends it from there; only the step after the insert changes. The provider's delivery status would go in the same row, so dispatch could see "sent 14:32, delivered" or a failure, and a failed send would be retried without losing the driver's tap.

## Decisions worth knowing

- **Access is checked in every server action, not only on the pages.** Actions are public POST endpoints. A driver forging the request for another driver's service, or calling a dispatch-only action, gets nothing (covered by the tests).
- **Time and ownership are enforced in SQL**, so the page listing cannot disagree with what the action allows.
- **Idempotency** comes from a unique key on `notices.service_id`, not from disabling a button.
- Login compares against a dummy hash when the email does not exist, so a wrong email and a wrong password take the same time.

## Stack and tools

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind, Postgres (`postgres` client), `jose` for the session cookie, `bcryptjs`. Hosted on Vercel with Supabase Postgres (free plans).

**AI used:** I built this with Claude Code (Claude Sonnet 5.5): it wrote most of the code and the test script, and I directed it, reviewed the decisions and tested on a real phone. The Supabase and Vercel accounts and the deploy are mine.

## Run locally

```
npm install
docker compose up -d          # Postgres on :54329
docker compose exec -T db psql -U transekur -d transekur < db/schema.sql
npm run db:seed               # demo users and services (resets data)
npm run dev
```

`.env.local` needs `DATABASE_URL` (see `docker-compose.yml`) and `SESSION_SECRET` (32+ chars). For a hosted database also set `DATABASE_SSL=1`.

## Tests

`tests/e2e.py` (Python stdlib, no browser) exercises the real forms of a running instance: 35 checks covering login, per-driver visibility, forged requests, double tap, time zone, input validation and the demo reset. It passed against the deployed version too. It does not check how the pages look; I checked that by hand on a phone.

## Questions I would ask Transekur

Should dispatch also be able to send the notice manually? Fixed message template and languages? Can "10 min" be repeated if the driver is late? Does the driver app need to work with a poor connection? Which channel by default, and what fallback if the client has no WhatsApp?
