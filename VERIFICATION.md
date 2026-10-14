# Final audit evidence — October 14, 2026

## Current $0 development pass — October 14, 2026

Release state remains **development only; not launched**. No subscription, paid resource, domain, live message, charge or production deployment was created. Public booking, messaging, reminders, indexing and payments remain disabled outside the disposable loopback tests. Automatic Vercel Git deployments remain disabled.

Current code/test revision: `ac438e729c16d06f8bedeb853a8e090be1e90982`. The final documentation commit records this evidence without changing the tested application.

- Fresh `npm ci`, lint, TypeScript, **44 unit tests** and production build pass locally. Production dependency audit reports zero vulnerabilities. Existing upstream ESLint peer warnings and development-only braces advisories remain documented.
- The five unchanged PostgreSQL test suites and seven concurrency scenarios pass on the existing standard GitHub Actions runner. Database and browser fixtures are synthetic and disposable, not salon records.
- Browser acceptance: **PASS: 10/10 tests** in [Quality run 38637256485](https://github.com/Cookarelli/jaz-it-up-beauty-lounge/actions/runs/38637256485), with all three jobs successful, including fresh install/lint/typecheck/44 unit tests/build, five SQL suites and seven concurrent scenarios. The local Supabase stack was disposed successfully afterward. The suite uses real local Supabase Auth, PostgREST, RLS and PostgreSQL with a production Next.js server. It tests phone and tablet layouts, guest reservation and receipt, idempotent retry, slot conflict, forged origin rejection, protected booking status, owner reschedule/cancel, private-page authorization, blocked public Auth signup, calendar views, recurring-hours edits, manual time off, stale availability responses and phone bookings.
- The browser checks uncovered and drove fixes for an internal-host origin mismatch and native form reset changing the selected weekday after a save. The guest receipt uses saved appointment data and omits private notes/customer contact fields. Old availability responses cannot replace a newly chosen date/service.
- Live Supabase was queried **read-only**: 11 migrations; zero customers/appointments; America/Chicago; both business/stylist weeks Tue–Fri 09:00–19:00 and Sat 09:00–15:00; Sun/Mon omitted (closed). All public tables retain RLS. Email, SMS, reminders and payments remain false; deposit policy is `none`. No live migration, seed, table mutation or policy change was performed in this pass.
- The 11 applied migration files are byte-for-byte unchanged from the prior `cf47a0f` commit. Clean histories are replayed only inside fresh disposable CI containers.
- Local browser review at 390px confirmed the current cream/teal layout fits. The public booking gate shows coming soon, with no reservation form. No photographs or logo files were available in `public/images`; placeholders remain identified as placeholders.
- The existing [Vercel visual preview](https://jaz-it-up-beauty-lounge-dodschf0i-steves-projects-e37a4ef4.vercel.app) was reopened successfully. It remains the **older `206251c` build**, not this change set. No updated Vercel deployment is claimed. It has no preview database and cannot demonstrate a real hosted reservation.

Supabase leaked-password protection is a **known, accepted temporary limitation of Free**, still disabled and unresolved. Existing password strength, restricted authentication and RLS measures are retained. No upgrade is required or authorized for current development; informational RLS notices were not silenced by opening data access.

Remaining acceptance: Delia’s personal Auth account and recovery/handoff; real contact/address and authorized media; unresolved service prices/durations; cancellation/privacy/retention approval; off-machine encrypted backup and isolated restore drill; final hosted-origin/abuse checks; owner walkthrough and explicit launch approval. Future messaging/payment activation has its own provider acceptance and budget decisions; neither is part of this $0 development phase.

See [Delia’s walkthrough](docs/DELIA_WALKTHROUGH.md) and [the isolated test instructions](docs/ISOLATED_TESTING.md).

## Earlier audit and deployment record

**Release decision: preview only.** See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [OPERATIONS.md](OPERATIONS.md). No live customer messages, live charges or public booking activation occurred. An automatic deployment unexpectedly targeted Production; it reached READY before cancellation and production serving was then paused in Vercel. With explicit user approval, that deployment was deleted and the project resumed with no production deployment. This is an incident record, not an approved release.

## Source and reproducibility

The checkout was clean at the beginning of the audit. `git pull --ff-only origin main` confirmed baseline `b0f23dc631a139478a89efdea3d431dd012d2607`. Existing app/schema/history were preserved. Node 24 is pinned in `.nvmrc` and CI; the local checks used Node 22.23.2 within the supported engine range. A fresh `npm ci` installed 391 packages without modifying the lockfile.

## Passed checks

- Local ESLint, TypeScript, all **40 unit tests**, optimized Next.js production build and `git diff --check` passed after the audit changes.
- Production-only dependency audit: **zero vulnerabilities**. Full audit: five high advisory entries from the development lint-tooling braces dependency chain, with no patched compatible braces release available. Upstream ESLint peer-range warnings remain; the lint command itself passes. These are documented residual risks, not silently suppressed.
- [GitHub Quality run 38625735196](https://github.com/Cookarelli/jaz-it-up-beauty-lounge/actions/runs/38625735196) passed at `2331519d11be0f56ae64fcbada156f273aa60c76`, the audit backend changes. Both the app check and disposable PostgreSQL 17 jobs succeeded.
- All **five SQL suites** passed after replaying every migration: catalog, management, scheduling, communications/payments and launch safety. They assert owner/manager versus outsider/stylist access, guest read restrictions, no direct guest writes, validation, optimistic revisions, manual booking, reschedule/cancel/complete/no-show, service approvals, closures/hours, notification/payment states and audit history.
- **Seven independent-connection concurrency scenarios** passed: 12 simultaneous same-slot bookings leave one winner; 8 duplicate requests yield one appointment; overlapping buffers reject one contender; hold versus booking and block versus booking serialize safely; two workers claim notifications once; 20 concurrent booking-limit requests permit five.
- Timezone tests cover Chicago local dates near UTC midnight, 23/25-hour days, skipped/repeated times, both DST transitions, uninterrupted lunch, adjacent appointments and whole-duration/buffer closing limits.
- Local production-server HTTP checks: all public routes and login returned 200; booking remained closed; missing origin returned 403; disabled booking/availability returned 503; unsigned cron returned 401; unconfigured provider webhooks returned 503; API no-store, nosniff/frame-denial headers, robots disallow-all and empty sitemap were verified.
- Mobile browser at 390px: catalog-to-book flow reaches the closed-booking message; content fits without horizontal overflow. Fixed the menu remaining open after route navigation; verified closure and Escape returning focus to the summary. Login fields have associated labels and correct autocomplete. Fixed normal unsigned redirects incorrectly displaying a failed-login message.
- Git-history scan found no private keys, Stripe/Supabase secret patterns or service-role JWTs in 228 inspected blobs before the final documentation commit. Scanner output reports its limitations; this is not a guarantee covering every credential format.

## Live Supabase verification

Project `fwxothhjxtvuupyeqsri`, Jaz It Up, America/Chicago: all 11 migrations through `20261014193528` are now applied; all 27 public tables have RLS enabled; zero appointments and one owner membership remain after migration. No test customers or appointments were inserted into this live project.

All 23 services and 15 variants were compared against the supplied owner catalog snapshot, including pricing, timing, length, approval flags and chemical bundles: **zero differences**. Unknown/provisional values remain visible but not instantly bookable. Confirmed Tue–Fri 09:00–19:00 / Sat 09:00–15:00 hours remain editable, with no automatic lunch/breaks.

The communications migration `20261014184518` and limiter migration `20261014193528` were applied through Supabase CLI after a verified encrypted export. A fresh dry run reports up to date. Read-back confirmed catalog, schedule, staff and role data unchanged; 11 sensitive RPCs are not executable by anonymous or authenticated client roles. Payment policy remains `none`; email, SMS and reminders are off. See [the migration record](docs/MIGRATION_RECORD_2026-10-14.md). Public contact/address fields are blank. Supabase's advisor reports leaked-password protection disabled; intentionally service-only RLS tables without policies are informational, not an instruction to open access.

## Deployment and acceptance limits

Browser inspection confirmed Vercel project `jaz-it-up-beauty-lounge`, team `steves-projects-e37a4ef4`, linked to the correct repository, on Hobby with Next.js/Node 24 and repository-root builds. The connector still returns a team-scoped 403; the authenticated browser provides inspection access. Supabase credentials are scoped to Production only. Preview lacks an isolated database; site URL and limiter secret are not configured. Automatic Git deployment is disabled by committed `vercel.json` to preserve the requested preview-only release boundary.

A real hosted reservation, signed-in owner browser workflow, provider delivery, Stripe sandbox Checkout, external scheduler, final domain/TLS and backup restoration have **not** passed acceptance. No credentials or production fixture bypass were introduced to manufacture a pass. The local PostgreSQL server cannot start under the macOS shared-memory sandbox; the real database suites therefore ran in CI. Accessibility checks are foundations, not a full WCAG/screen-reader certification.

The final audit code and mobile/admin fixes also passed [Quality run 38628412131](https://github.com/Cookarelli/jaz-it-up-beauty-lounge/actions/runs/38628412131) at `206251c2a1376e5ad832c5675ed7baae91efc4b5`. The updated Git-history scan covered 237 blobs with no matching secrets. Unsigned `/admin`, customer, appointment and payment routes were rechecked: 307 to `/admin/login`, private no-store, with no misleading failed-login error.

## Verified hosted preview

- **URL:** https://jaz-it-up-beauty-lounge-dodschf0i-steves-projects-e37a4ef4.vercel.app
- **Target / status:** Preview / READY, build duration 49 seconds.
- **Deployment:** `2neHgj4xJv5paVGbs8zAS5DX1Da8`; source commit `206251c2a1376e5ad832c5675ed7baae91efc4b5`.
- The final documentation/deployment-control commit retains this same application code. It changes release documentation and disables automatic Git deployments; this preview is not represented as that later commit.
- Hosted browser verification at 390px: Home → Services (23 parent services) → mobile menu → Book; no horizontal overflow, menu closes, “Online booking is coming soon,” zero booking forms. Admin redirects to login and explicitly reports missing configuration without exposing records. No console errors/warnings were observed during this journey.
- Preview robots metadata is `noindex, nofollow`. Its canonical still defaults to localhost because `NEXT_PUBLIC_SITE_URL` is unset; configure the actual intended hostname and rebuild before SEO acceptance. No public launch indexing was enabled.
- Local tablet login inspection at 820px showed no horizontal overflow; authenticated dashboard tablet acceptance is still pending.
- Preview has no Supabase credentials, so it renders the fallback catalog and prevents reservations. **A real end-to-end appointment creation test was not possible and has not passed.** The operator must provision an isolated test database, apply migrations, supply preview-only credentials/limiter secret, approve controlled test activation, and complete the acceptance script in OPERATIONS.
- The first automatic build unexpectedly used Production. Cancellation lost a race with its 41-second build; it was paused, then the single generated deployment was deleted with user approval. No booking, messaging or payment feature was enabled. Production is now empty. The explicitly targeted Preview deployment above was created after this correction. Automatic Git deployments are disabled to avoid recurrence.
