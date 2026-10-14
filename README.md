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

The configured Supabase project is `fwxothhjxtvuupyeqsri`, named Jaz It Up, in OptAImal LLC. All six tracked migrations have been applied there. **Do not rerun the historical bootstrap or execute applied migrations again.** `supabase/migrations` is the canonical schema history.

For another empty Supabase project, apply every migration in filename order through Supabase migration tooling. For an existing project at the previous main commit, apply only the four new migrations beginning `20261014165914`, after checking migration history and taking a backup. They expand the schema, preserve existing location/stylist and appointment IDs, backfill customer links and booking snapshots, and never delete client records. The final migration audits operational changes without copying client contact details into audit logs.

`20261014170150_seed_owner_service_menu.sql` installs the owner-supplied board. `supabase/seed.sql` provides the same idempotent seed for development. Natural-key conflict handling never overwrites Delia’s later edits. No customers, Auth users, appointments, business hours, phone numbers or real client data are seeded. Buffers default to zero as an explicit configurable scheduling default, not an assertion about salon preparation time.

The seed has **23 services and 15 variants** across CUTS, WAXING, COLOR, PERMS and EXTRAS. Men’s/women’s adult haircut variants retain the $20–$30 board range with their supplied 30/60-minute durations; Delia must set individual prices. TBD or provisional durations stay unapproved. Perm variants cover above-shoulder, shoulder, and below-shoulder lengths with the supplied approximate 90–120-minute range; no exact time or length surcharge is invented. Brazilian blowout variants use the supplied $150/$200 prices and 120 minutes. Pins/braids remains unapproved because “up to 60 minutes” is not a confirmed exact duration. All color, perm and Brazilian chemical bundles include haircut/style once.

## Schema and access

- `salons`, `locations`: salon ownership, locations and timezone. Existing location IDs remain intact.
- `staff`, `stylists`, `staff_roles`: staff profiles, preserved bookable stylist IDs, and salon-scoped Auth membership. Roles are owner, manager and stylist; only owner/manager roles administer the salon.
- `services`, `service_variants`: exact/starting/range/consultation integer-cent pricing, nullable exact timing, approximate timing bounds, independent approvals, status, length, ordering, buffers, private notes and optimistic revisions.
- `business_hours`, `schedule_exceptions`, `availability`: general opening hours, dated closures/restrictions and explicitly published stylist windows. No opening hours are fabricated. Until general hours are configured, published availability is the explicit owner-controlled schedule. Exceptions restrict these windows; they do not silently add hours outside availability.
- `appointment_holds`, `appointments`, `customers`: expiring opaque holds, immutable booking snapshots, contact details and buffered scheduling checks. Holds/reservations use per-stylist transaction locks; appointments also retain their database exclusion constraint.
- `notification_jobs`, `notification_events`: transactional outbox, leased retries and delivery-attempt records.
- `audit_logs`: append-only metadata (actor, entity, operation, revision); no copied client contact or notification payloads.
- `booking_policies`: lead time, horizon, slot spacing, hold timeout, cancellation configuration and future deposit options. Payments cannot be enabled in this release, including through direct SQL updates under application roles.

RLS is enabled on every table. Anonymous users can read only explicit public columns of published services/variants, never private admin notes. Authenticated non-staff users have no client or management access. Role assignment is SQL/operator-only; clients cannot grant themselves membership. Server-only holds/notification tables intentionally have no client RLS policies. Security advisors report this as informational. No unauthenticated role has direct table writes or booking RPC execution.

## Delia’s admin access and service editing

Create Delia’s Supabase Auth user manually, disable public signups, configure password recovery/SMTP, then grant membership using her actual Auth UUID:

```sql
insert into public.staff_roles(salon_id,user_id,staff_id,role)
select s.salon_id,'<DELIA_AUTH_UUID>'::uuid,s.id,'owner'
from public.staff s where s.name='Delia';
```

Use `/admin/login`, then `/admin/services`. Expand a service or variant, configure the exact or starting price and exact duration, and explicitly approve both. Board ranges and consultation prices remain non-bookable. Draft and archived entries are hidden from the public catalog. Published entries needing review remain visible. Archive instead of deleting to preserve history. The editor validates blank versus zero, integer cents, bounds, duration ranges and buffers. A transaction checks the submitted revision and rejects stale edits; all changes append audit metadata. Catalog identity, parent, category and chemical bundle metadata are protected from this editor.

The legacy `salon_admins` table is retained for compatibility with old installations; migration copies its existing memberships into staff_roles. New members must use staff_roles. Existing admin actions authenticate and authorize each mutation, independently of route protection.

## Automated database tests

`supabase/tests/catalog.sql` is a transactional assertion suite covering public/private RLS, writes, private notes, owner edits, optimistic concurrency, approval gates, variant routing, holds, buffers, cancellations, hours, exceptions, snapshots, notifications, auditing and disabled payments. Synthetic identities and bookings are rolled back.

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/salon_test npm run test:db
```

Use a disposable database. On an empty PostgreSQL 17 test database, the runner installs a minimal Auth/role compatibility fixture and replays every migration before running assertions. Existing test schemas are tested without replay. GitHub CI includes a PostgreSQL service for a clean replay; no Supabase credentials are needed. The fixture is test-only and must never be installed into a live Supabase project. Validation tests also assert all 23 services, 15 variants, supplied prices, owner-review flags, chemical bundles, labels and daylight-saving behavior. Live SQL tests have passed on the salon project with fixtures rolled back. Full simultaneous-request load testing and a signed-in browser test still require runtime credentials and an admin user.

## Notifications and deployment

`NotificationAdapter` is the provider boundary. Configure `NOTIFICATION_WEBHOOK_URL`, `NOTIFICATION_WEBHOOK_TOKEN`, and a random `CRON_SECRET` of at least 32 characters. The receiver must deduplicate by the job’s Idempotency-Key and deliver transactional messages. Call `/api/cron/notifications` using `Authorization: Bearer <CRON_SECRET>` from a trusted scheduler. Jobs use five-minute leases and at most ten attempts; cancelled appointments are skipped. Events record attempted/delivered/failed outcomes. Delivery is at least once. No messaging provider is provisioned automatically.

For Vercel, import the repository, select Next.js/Node 24, set environment variables and the canonical HTTPS NEXT_PUBLIC_SITE_URL, then deploy. Keep preview/production databases separate. Configure Auth site URL/redirects, notification scheduling and rate limiting/bot protection. Confirm address, phone, hours, actual policies, service approvals, and privacy retention before launch. No hosting deployment is claimed by this repository update. There is no payment processing, customer account requirement, or customer self-service cancellation link.

## Dependencies

Production audit is clean at the previous verification. The full audit has five development-only entries in Next’s lint-tooling braces chain; no patched stable braces release was available. ESLint 10 runs the checks, though upstream lint plugins still declare older peer ranges, so npm prints peer warnings. Recheck these upstream advisories before launch. Keep the lockfile pinned.
