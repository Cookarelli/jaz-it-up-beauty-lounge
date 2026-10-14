# Dashboard verification

Story: an authorized salon owner signs in, manages appointments/customers/hours/services/content through server actions, and receives validated, tenant-scoped Postgres changes with audit history.

- Base main: `5818f8e4fcc80f2597ffe4f65f6635767bbc4069`; existing IDs/history preserved.
- New protected routes: Today, calendar, bookings/details/new, customers/details/new, hours/time off, settings/policies, reports and audit history.
- Every private page and action verifies Supabase Auth and current staff membership. RLS independently scopes table operations to the salon. No service key enters a client component.
- TypeScript, lint, 23 unit/validation tests and optimized Next.js build pass.
- Database suites replay all migrations on disposable PostgreSQL 17 in GitHub CI. Local PostgreSQL startup is blocked by sandbox shared-memory permissions. Long live test transactions were rejected by the connector with `Invalid or expired requestState`; no live test success is claimed for this release.
- Migrations are applied to the existing salon Supabase project; no new cloud resources or payment integrations were created.
- UI uses associated labels, keyboard-accessible controls, live error/status messages, native confirmation dialogs, responsive columns and tablet/mobile calendar layouts.
- Remaining acceptance: sign in with Delia’s provisioned account and verify owner screens against real salon configuration, configure provider email delivery, and exercise simultaneous reservations under load. No real customer data or test passwords are tracked.
