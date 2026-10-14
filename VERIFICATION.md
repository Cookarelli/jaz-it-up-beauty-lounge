# Final audit evidence — October 14, 2026

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

## Read-only live Supabase verification

Project `fwxothhjxtvuupyeqsri`, Jaz It Up, America/Chicago: nine applied migrations through `20261014182155`; 21 public tables all have RLS enabled; zero appointments at audit time; one owner membership. No test customers or appointments were inserted into this live project.

All 23 services and 15 variants were compared against the supplied owner catalog snapshot, including pricing, timing, length, approval flags and chemical bundles: **zero differences**. Unknown/provisional values remain visible but not instantly bookable. Confirmed Tue–Fri 09:00–19:00 / Sat 09:00–15:00 hours remain editable, with no automatic lunch/breaks.

The communications migration `20261014184518` is still absent after an earlier connector failure (`Invalid or expired requestState`). The new limiter migration `20261014193528` is also pending. Their success in CI is not live migration success. Public contact/address fields are blank. Supabase's advisor reports leaked-password protection disabled; intentionally service-only RLS tables without policies are informational, not an instruction to open access.

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
