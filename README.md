# Jaz It Up Beauty Lounge

Next.js App Router, TypeScript, Tailwind, Supabase Auth/Postgres, and Vercel-ready deployment. Public customers do not need accounts. Payments remain disabled by a database constraint.

## Local development / Mac Mini

Install Node 24 LTS and Git. On a Mac Mini, install Xcode Command Line Tools (`xcode-select --install`), then Node from nodejs.org or a version manager. From the repository root:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Local development needs the Mac awake; Vercel hosting does not. Fill the project URL and publishable key in `.env.local`. Guest reservation APIs additionally require the server-only `SUPABASE_SECRET_KEY`. Never prefix that key with NEXT_PUBLIC or commit environment files. Without a configured backend the public menu uses the owner-supplied seed snapshot and booking fails closed.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Migrations and seed

The configured Supabase project is `fwxothhjxtvuupyeqsri`, named Jaz It Up, in OptAImal LLC. All tracked migrations through `20261014182155_delia_confirmed_schedule.sql` have been applied there. **Do not rerun the historical bootstrap or execute applied migrations again.** `supabase/migrations` is the canonical schema history.

For another empty Supabase project, apply every migration in filename order through Supabase migration tooling. For an existing project at commit `5818f8e`, apply only `20261014172112_owner_management_dashboard.sql` and `20261014175238_management_reports_and_notification_generations.sql`, after checking migration history and taking a backup. They expand the schema, preserve existing location/stylist and appointment IDs, backfill customer links and booking snapshots, and never delete client records. The new migrations add owner workflows, recurring hours, time off, public content settings, reporting, revision checks and notification generations. They preserve customer records and historical appointments.

`20261014170150_seed_owner_service_menu.sql` installs the owner-supplied board. `supabase/seed.sql` provides the same idempotent seed for development. Natural-key conflict handling never overwrites Delia’s later edits. No customers, Auth users, appointments, phone numbers or real client data are seeded. The separate confirmed-schedule migration installs Delia’s explicitly supplied working and business hours. Buffers default to zero as an explicit configurable scheduling default, not an assertion about salon preparation time.

The seed has **23 services and 15 variants** across CUTS, WAXING, COLOR, PERMS and EXTRAS. Men’s/women’s adult haircut variants retain the $20–$30 board range with their supplied 30/60-minute durations; Delia must set individual prices. TBD or provisional durations stay unapproved. Perm variants cover above-shoulder, shoulder, and below-shoulder lengths with the supplied approximate 90–120-minute range; no exact time or length surcharge is invented. Brazilian blowout variants use the supplied $150/$200 prices and 120 minutes. Pins/braids remains unapproved because “up to 60 minutes” is not a confirmed exact duration. All color, perm and Brazilian chemical bundles include haircut/style once.

## Schema and access

- `salons`, `locations`: salon ownership, locations and timezone. Existing location IDs remain intact.
- `staff`, `stylists`, `staff_roles`: staff profiles, preserved bookable stylist IDs, and salon-scoped Auth membership. Roles are owner, manager and stylist; only owner/manager roles administer the salon.
- `services`, `service_variants`: exact/starting/range/consultation integer-cent pricing, nullable exact timing, approximate timing bounds, independent approvals, status, length, ordering, buffers, private notes and optimistic revisions.
- `working_hours`, `business_hours`, `time_blocks`, `schedule_exceptions`, `availability`: recurring stylist windows, public opening hours, time off, dated closures/restrictions and legacy dated windows. Online slots combine recurring and dated stylist windows, then enforce business hours, closures, blocks, buffers and holds. Special hours restrict windows. Removing all public business hours restores stylist-only availability; the UI explains this before confirmation.
- `salon_profiles`: owner-editable public contact, address, HTTPS social links, homepage headline, introduction and about copy. No private customer or staff contact information is stored here.
- `appointment_holds`, `appointments`, `customers`: expiring opaque holds, immutable booking snapshots, contact details and buffered scheduling checks. Holds/reservations use per-stylist transaction locks; appointments also retain their database exclusion constraint.
- `notification_jobs`, `notification_events`: transactional outbox, leased retries and delivery-attempt records.
- `audit_logs`: append-only metadata (actor, entity, operation, revision); no copied client contact or notification payloads.
- `booking_policies`: lead time, horizon, slot spacing, hold timeout, cancellation configuration and future deposit options. Payments cannot be enabled in this release, including through direct SQL updates under application roles.

RLS is enabled on every table. Anonymous users can read explicit public columns of published services/variants, salon public profiles and public business hours. They cannot read customers, appointments, private notes, time off reasons, policies or audit logs. Authenticated non-staff users have no client or management access. Role assignment is SQL/operator-only; clients cannot grant themselves membership. Server-only holds/notification tables intentionally have no client RLS policies. Security advisors report this as informational. No unauthenticated role has direct table writes or booking RPC execution.

## Provision Delia’s administrator account securely

1. In the salon project’s Supabase Authentication settings, disable public sign-ups. Confirm the deployed HTTPS site URL and exact approved redirect URLs; avoid wildcard production redirects. Enable appropriate Auth rate limits and secure SMTP/recovery before launch.
2. In Authentication → Users, create Delia’s user using her actual email and a long unique password generated and saved in her password manager (at least 20 random characters). Verify the address belongs to Delia before marking it confirmed. Do not use a shared or default password, paste credentials into chat, or send an account-creation URL. This repository creates no account automatically.
3. Copy that user’s UUID and the intended `salons.id`. Put `ADMIN_AUTH_USER_ID`, `ADMIN_SALON_ID`, and the server-only `SUPABASE_SECRET_KEY` in your ignored `.env.local`, then run:

```sh
node --env-file=.env.local scripts/provision-admin.mjs
```

The script requires an existing email-confirmed, non-anonymous user and an existing salon, then grants that one user an owner role. It creates no account, password, invitation, link or message. Remove the two provisioning variables afterwards. Never expose the secret key through a `NEXT_PUBLIC_` variable or client component. If using the SQL editor instead, grant the verified UUID to the explicitly chosen salon in `staff_roles`; this is a one-time operator setup, not an owner scheduling task.

4. Delia signs in at `/admin/login`. An owner or manager role is checked against the database on every server request/action; an ordinary stylist or unrelated authenticated user cannot access customers. Test sign-out, then attempt a private URL to verify it returns to sign-in. Revoke access by removing the role; a still-valid Auth token alone no longer grants salon access.

Use `/admin/login`, then `/admin/services`. Expand a service or variant, configure the exact or starting price and exact duration, and explicitly approve both. Board ranges and consultation prices remain non-bookable. Draft and archived entries are hidden from the public catalog. Published entries needing review remain visible. Archive instead of deleting to preserve history. The editor validates blank versus zero, integer cents, bounds, duration ranges and buffers. A transaction checks the submitted revision and rejects stale edits; all changes append audit metadata. Catalog identity and parent IDs remain immutable. Categories are editable and automatically propagate to variants. Custom categories appear on the public page. Once a chemical bundle includes haircut/style it cannot lose that guarantee through category changes. New services and variants start as unapproved drafts.

The legacy `salon_admins` table is retained for compatibility with old installations; migration copies its existing memberships into staff_roles. New members must use staff_roles. Existing admin actions authenticate and authorize each mutation, independently of route protection.

## Owner dashboard workflows

- **Today:** today’s visits, the next/current appointment, upcoming bookings and estimated service value.
- **Calendar:** daily, weekly and monthly layouts, date navigation and stylist filter. Time-off/closure indicators appear alongside appointments. All form dates and displayed times use the salon timezone (currently America/Chicago); skipped/repeated DST times are rejected instead of guessed. Calendar views warn if their 1,000-record bound is reached; booking search remains paginated.
- **Bookings:** search customer name/email/phone, filter service/status/date, inspect details and immutable original service snapshot. Add a customer first, then a phone booking or walk-in with an explicitly agreed duration and integer-cent estimate. Email is optional; no email means no email notification. Manual bookings may fall outside recurring working hours, but cannot override an appointment, buffer, time-off block, special closure or live customer hold. Duplicate submission IDs are idempotent.
- **Appointment management:** reschedule, change estimate/duration, cancel, complete or mark no-show. Changes require a confirmation dialog. Stale revisions are rejected. Completed/no-show appointments cannot be marked before their start; closed bookings cannot be reopened/rescheduled. Use a new booking if needed. Cancellation releases the slot, while history is retained; no appointment delete button exists.
- **Hours & time off:** configure recurring stylist and business hours with ordinary weekday/time inputs, add blocks and special closures, remove schedule entries with confirmation. Conflicting closures/blocks require existing confirmed appointments to be moved first. Recurring hours changes preserve existing bookings. No database table editing is needed for salon scheduling.
- **Customers:** add/search customers, update private notes/contact details and browse paginated appointment history. Appointment contact snapshots are preserved when a customer profile changes.
- **Salon & policies:** publish address/contact/social links/homepage copy, configure lead time and cancellation wording, store future fixed/percent deposit policy. Payments remain disabled by the database. Policy wording is stored for owner use; no cancellation fees are automatically collected.
- **Reports:** aggregate full date ranges inside Postgres, showing appointment volume and estimated value by status. Collected revenue is explicitly untracked. Cancelled/no-show values are excluded from the headline confirmed/completed estimate.
- **Change history:** append-only actor/entity/revision records and safe before/after scheduling values. Contacts and private notes are not copied into audit payloads.

## Delia’s confirmed schedule

`20261014182155_delia_confirmed_schedule.sql` sets **America/Chicago** on the salon and Delia’s location, then installs the same week in both business hours and her recurring working hours:

| Day | Local hours |
| --- | --- |
| Sunday–Monday | Closed |
| Tuesday–Friday | 9:00 AM–7:00 PM |
| Saturday | 9:00 AM–3:00 PM |

There is no scheduled lunch and no automatic break between appointments. Only each service/variant’s configured preparation and cleanup buffers reserve additional time. The full occupied interval must fit inside the intersection of working hours, business hours and any special-hours restriction. Existing manual blocks, closures and appointments remain intact.

The owner’s start-time spacing remains configurable. In addition to that grid, the engine offers exact starts immediately before/after occupied intervals and the latest fitting start before closing. A 15-minute appointment can therefore be followed immediately by another even when the regular start grid is 30 minutes. Configured buffers still apply; half-open occupied intervals permit exact adjacency and reject overlaps.

Delia can edit her schedule and manually block any time in **Admin → Hours & time off**. Changes affect future availability without moving or cancelling existing bookings. The migration runs once; the app and service seed never reset later owner edits. Other environments at commit `f488d6a` need only this pending migration. If a different installation already has Sunday/Monday hours, the migration stops for reconciliation in the dashboard instead of erasing them.

`scheduling.sql` exercises the installed week, uninterrupted lunch, full-duration/buffer closing limits, variant timing, short back-to-back services, holds/conflicts, manual blocks, owner edits and appointment preservation. Future fixtures straddle both Chicago DST transitions; local opening stays at 9 AM while UTC changes between 14:00 and 15:00.

## Automated database tests

`supabase/tests/catalog.sql`, `supabase/tests/management.sql`, and `supabase/tests/scheduling.sql` are transactional assertion suites covering public/private RLS, writes, private notes, owner edits, optimistic concurrency, approval gates, variant routing, holds, buffers, cancellations, hours, exceptions, snapshots, notifications, auditing and disabled payments. Synthetic tenants, identities and bookings are rolled back. Management tests include owner/outsider/stylist authorization, direct-table privacy, manual bookings, duplicate-submit protection, reschedules, stale changes, cancellation, no-show, completion, blocks/closures, recurring hours, public content, notification generations, reporting and audit history.

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/salon_test npm run test:db
```

Use a disposable database. On an empty PostgreSQL 17 test database, the runner installs a minimal Auth/role compatibility fixture and replays every migration before running assertions. Existing test schemas are tested without replay. GitHub CI includes a PostgreSQL service for a clean replay; no Supabase credentials are needed. The fixture is test-only and must never be installed into a live Supabase project. Validation tests also assert all 23 services, 15 variants, supplied prices, owner-review flags, chemical bundles, labels and daylight-saving behavior. The prior catalog suite passed on the live project. For this dashboard release, the full suites run in the disposable PostgreSQL CI job. Local macOS sandbox shared-memory restrictions prevent starting PostgreSQL here. A real signed-in browser acceptance test still requires Delia’s provisioned account; no test login bypass is included.

## Notifications and deployment

`NotificationAdapter` is the provider boundary. Configure `NOTIFICATION_WEBHOOK_URL`, `NOTIFICATION_WEBHOOK_TOKEN`, and a random `CRON_SECRET` of at least 32 characters. The receiver must deduplicate by the Idempotency-Key (`job UUID:generation`) and deliver transactional messages. Call `/api/cron/notifications` using `Authorization: Bearer <CRON_SECRET>` from a trusted scheduler. Jobs use five-minute leases and at most ten attempts; cancelled appointments are skipped. Reschedules revise payloads/due times and increment generation so an old confirmation cannot deduplicate a new one. Workers check current status/generation before sending and acknowledge only the claimed generation. A message already accepted by a provider cannot be recalled by a later cancellation. Events record attempted/delivered/failed outcomes. Delivery is at least once. No messaging provider is provisioned automatically.

For Vercel, import the repository, select Next.js/Node 24, set environment variables and the canonical HTTPS NEXT_PUBLIC_SITE_URL, then deploy. Keep preview/production databases separate. Configure Auth site URL/redirects, notification scheduling and rate limiting/bot protection. Confirm address, phone, actual policies, remaining service approvals, and privacy retention before launch. Delia’s operating hours are already confirmed and configured. No hosting deployment is claimed by this repository update. There is no payment processing, customer account requirement, or customer self-service cancellation link.

## Dependencies

Production audit is clean at the previous verification. The full audit has five development-only entries in Next’s lint-tooling braces chain; no patched stable braces release was available. ESLint 10 runs the checks, though upstream lint plugins still declare older peer ranges, so npm prints peer warnings. Recheck these upstream advisories before launch. Keep the lockfile pinned.
