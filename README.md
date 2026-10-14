# Jaz It Up Beauty Lounge

Next.js App Router application for Delia: a responsive public salon website, guest booking, and private Supabase-authenticated management.

## Local setup (including Mac Mini)

Install Node.js 24 LTS (Node 22.23+ also works), Git, and a code editor. On a Mac Mini, install Xcode Command Line Tools with `xcode-select --install`; install Node from nodejs.org or your preferred version manager. In this project directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public site runs without credentials; booking and admin fail closed. Never commit `.env.local`, secrets, or client records. Keep the Mac awake during development; Vercel hosts the live website, so the Mac need not remain on after deployment.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Supabase setup

Use an existing project or create one manually after reviewing its plan. No cloud resources are automatically provisioned. Run `supabase/bootstrap.sql` once in a NEW project SQL editor. It creates tables, RLS policies, explicit grants, service-role-only booking/queue RPCs, a location, and Delia’s stylist entry. It intentionally seeds no services or customers. This is an initial SQL bootstrap, not an applied migration; adopt Supabase CLI migrations for subsequent changes.

Set the Supabase URL, publishable key and server-only secret key in `.env.local`. Create Delia’s Auth user manually, disable public signups, configure password recovery/SMTP in Supabase, and insert that Auth UUID into `salon_admins` through the SQL editor. Membership table policies restrict users to their own membership; arbitrary authenticated users have no management rights. Service-role keys are used only in server modules.

Sign in at `/admin/login`, add actual services and prices, then publish availability at `/admin/availability`. Enter timestamps with explicit offsets. Availability is offered at 30-minute intervals, at least two hours ahead, up to 90 days ahead. Current salon timezone is America/Chicago; confirm it with Delia before launch. Calendar boundaries handle daylight saving changes.

## Architecture

- `app/`: server-rendered customer pages, booking APIs, login, private admin route group.
- `components/`: shared site UI, booking form and catalog form fields.
- `lib/`: validation, environment, Supabase, salon date calculations, notification adapter.
- `supabase/bootstrap.sql`: initial relational schema and transaction functions.
- `tests/`: input validation and daylight-saving regression tests.

Locations own stylists; availability and appointments belong to stylists. Services are shared by the salon for now. Add location/stylist-specific offerings only when needed. Appointments snapshot price; the exclusion constraint prevents overlapping active appointments even under concurrent requests. Booking and notification jobs commit atomically. Removing hours does not cancel existing appointments. Staff can mark appointments cancelled or completed; rescheduling currently means cancelling and booking a new time.

## Notifications

`NotificationAdapter` is the provider boundary. `WebhookAdapter` sends authenticated JSON with an idempotency key to an operator-controlled email/SMS delivery service. Configure URL and bearer token, and a random CRON_SECRET of at least 32 characters. The receiver must deduplicate by job ID, deliver transactional messages, and treat all payloads as confidential. No provider is provisioned or billed by this repository.

Call `GET /api/cron/notifications` using `Authorization: Bearer <CRON_SECRET>` from a trusted scheduler every few minutes. Configure a Vercel Cron schedule only after checking plan frequency limits, or use another scheduler. Jobs use five-minute leases, retry up to ten attempts, and skip cancelled appointments. Monitor exhausted jobs in Supabase and reconcile provider receipts before resetting attempts. Delivery is at least once; receiver idempotency is mandatory. The webhook should include service name and local time in its templates using the reference if needed. Without an adapter or scheduler, reservations save but email/reminders do not send.

## Vercel deployment

Import `Cookarelli/jaz-it-up-beauty-lounge`, select Next.js, use Node 24, and configure the environment variables in the intended environment. Set NEXT_PUBLIC_SITE_URL to the canonical HTTPS origin. Keep preview and production databases separate. Add the domain and enable HTTPS. No Vercel resources have been created automatically. Validate Supabase Auth site URL and redirects against the final domain. Admin responses are private/no-store.

Before accepting customers: confirm address, phone, business hours, timezone, actual services/prices, cancellation policy, final privacy notice and retention process; replace gallery placeholders with licensed, consented photos in `public/images`; configure and verify notifications. No salon photos were supplied. Typography is a wordmark treatment, not a claimed supplied logo.

## Verification and launch requirements

Automated local checks cover lint, TypeScript, build, input validation and DST. With a real Supabase project, run the SQL and verify guest booking, a simultaneous same-slot race (only one succeeds), slot removal, cancellation, notification retries/idempotency and denial of anonymous/non-admin access to customer data. Database execution and live notification delivery cannot be verified without credentials. Run Supabase security advisors after applying SQL.

Booking includes same-origin checks, request validation, a honeypot and a database-backed per-email cooldown. Before public launch configure platform rate limits/bot protection; the email cooldown alone does not prevent distributed booking abuse. There is no customer self-service cancellation link yet. Optional deposits/payments should later use a separate payment adapter and verified provider webhooks; no payment information is collected now.

## Dependency audit

Production dependency audit: zero known vulnerabilities at verification time. Full audit reports five high-severity entries in the development-only `eslint-config-next → fast-glob → micromatch → braces` chain (GHSA-vfj7-8cjw-p6xm). The registry offers no patched stable braces release at verification time; npm suggests an inappropriate Next lint-config downgrade. Do not feed untrusted glob patterns to lint tooling. Recheck upstream before release.
