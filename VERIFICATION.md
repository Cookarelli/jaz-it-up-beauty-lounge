# Dashboard verification

Story: an authorized salon owner signs in, manages appointments/customers/hours/services/content through server actions, and receives validated, tenant-scoped Postgres changes with audit history.

- Base main: `5818f8e4fcc80f2597ffe4f65f6635767bbc4069`; existing IDs/history preserved.
- New protected routes: Today, calendar, bookings/details/new, customers/details/new, hours/time off, settings/policies, reports and audit history.
- Every private page and action verifies Supabase Auth and current staff membership. RLS independently scopes table operations to the salon. No service key enters a client component.
- TypeScript, lint, 24 unit/validation tests and optimized Next.js build pass.
- Database suites replay all migrations on disposable PostgreSQL 17 in GitHub CI. Local PostgreSQL startup is blocked by sandbox shared-memory permissions. Long live test transactions were rejected by the connector with `Invalid or expired requestState`; no live test success is claimed for this release.
- Migrations are applied to the existing salon Supabase project; no new cloud resources or payment integrations were created.
- UI uses associated labels, keyboard-accessible controls, live error/status messages, native confirmation dialogs, responsive columns and tablet/mobile calendar layouts.
- Remaining acceptance: sign in with Delia’s provisioned account and verify owner screens against real salon configuration, configure provider email delivery, and exercise simultaneous reservations under load. No real customer data or test passwords are tracked.

## Confirmed schedule update

- Added forward-only migration `20261014182155_delia_confirmed_schedule.sql`, applied to the salon project.
- Tuesday–Friday 09:00–19:00 and Saturday 09:00–15:00, America/Chicago; Sunday/Monday closed. No lunch/break blocks inserted and no appointments, buffers or manual blocks rewritten.
- Availability intersects working/business/special hours before checking the full buffered interval. Exact gap boundaries allow adjacent services outside the regular start grid.
- Added SQL scheduling regression coverage and a 24th TypeScript test for local opening times around spring/autumn DST. Catalog tests now use an isolated salon rather than depending on the owner’s working week.
- Local lint, typecheck, all 24 unit tests and production build pass. Live read-only checks confirm the five configured days, lunchtime availability and unchanged appointment/manual-block counts.
