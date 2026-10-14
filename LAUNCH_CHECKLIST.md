# Launch checklist

Audit date: October 14, 2026. **Release decision: preview only; public booking is not approved for launch.** This is a record of verified results and remaining work, not a deployment certificate. See [OPERATIONS.md](OPERATIONS.md) for the procedures and [VERIFICATION.md](VERIFICATION.md) for evidence.

## Before customers can book — P0

- [ ] Verify the Vercel team, project, plan, branch, environment and deployed commit. The project `jaz-it-up-beauty-lounge` is connected to the correct GitHub repository; deployment acceptance remains pending. The repository disables main-branch auto-deployment in `vercel.json`; retain that rule while blockers remain. The current team is on Hobby, so a suitable commercial plan is also required for launch.
- [ ] Back up Supabase, verify migration history, then apply the two pending migrations in order: `20261014184518_communications_and_optional_deposits.sql` and `20261014193528_launch_safety_and_api_limits.sql`. Rehearse on an isolated test database first. The salon project currently has nine migrations through `20261014182155`.
- [ ] Use an isolated Supabase project for preview acceptance. Never share production service credentials with previews or test runners. Confirm the integration supplied the variable names this app actually reads; linking integrations alone does not apply migrations or provision salon roles.
- [ ] Set the public Supabase URL/publishable key, server-only `SUPABASE_SECRET_KEY`, HTTPS `NEXT_PUBLIC_SITE_URL`, and random `BOOKING_RATE_LIMIT_SECRET` (32+ characters). Test the database limiter on the actual hosting platform. Keep `PUBLIC_BOOKING_ENABLED=false` outside an approved, protected test deployment.
- [ ] Provision Delia's own verified Auth identity, grant only her intended salon role, test sign-in/sign-out and revoke the temporary owner's access after handoff. Disable public Auth sign-ups. Resolve the leaked-password-protection advisor warning if supported by the selected plan. Test the documented recovery procedure; this app has no self-service password-reset screen.
- [ ] Publish real salon phone, email, address, cancellation terms, privacy contact and an approved retention policy. These contact fields are currently blank. Approve each remaining price/duration before making that service instantly bookable; unresolved entries can remain visible for consultation.
- [ ] Complete the protected preview acceptance script in OPERATIONS: a real guest reservation through the browser and deployed API, conflict/retry checks, signed-in admin management, cancellation/rescheduling, mobile/tablet/keyboard checks. SQL tests do not replace this acceptance.
- [ ] Verify backups by restoring into an isolated environment. Assign an operator, monitoring recipient and incident contact. Approve a maximum tolerable data-loss and recovery time.
- [ ] Delia approves public booking after the evidence above is recorded. Only then enable `PUBLIC_BOOKING_ENABLED=true` in the intended release and verify again. Enable `SITE_INDEXING_ENABLED=true` separately after domain/content approval. Both default false; preview indexing remains disallowed.

## Optional channels — remain off until separately accepted

- [ ] Email: verify sending domain, sender, API credentials, signed delivery webhook, owner transactional-email setting and a controlled recipient test. Configure authenticated five-minute scheduling and operational alerts. Keep `NOTIFICATIONS_ENABLED=false` and `EMAIL_PROVIDER=disabled` until ready.
- [ ] Reminders: Delia approves offsets (proposals: 24 hours / 2 hours). Verify customer consent, reschedule replacement, cancellation suppression, retry deduplication and opt-out. No consent is inferred from an existing customer record.
- [ ] SMS: registered sender, country requirements, explicit consent, STOP handling and signed callback testing before `SMS_ENABLED=true` and owner approval. Ambiguous delivery requires reconciliation, not blind resend.
- [ ] Deposits: keep policy `none` and `PAYMENTS_ENABLED=false`. Before optional activation, accept refund/cancellation terms, verify Stripe account/mode/endpoint and a signed event, then test Checkout success/failure/expiry/interruption/refund in Stripe test mode. A browser return must never confirm payment. No live card test is authorized by this audit.

## Audit matrix

| Area | Result | Evidence / remaining limit |
| --- | --- | --- |
| Fresh install / lockfile | PASS | `npm ci`; pinned lockfile; Node 24 in CI. Upstream ESLint peer-range warnings remain. |
| Types / lint / production build | PASS | Local production build and GitHub Quality checks. |
| Unit / integration | PASS | 40 TypeScript tests; five PostgreSQL assertion suites replay all migrations in disposable PostgreSQL 17. |
| Migrations / RLS | PARTIAL | Clean replay passes; 21 existing live tables have RLS. Two migrations are still pending on the salon project. |
| Customer privacy / guest API | PASS in tests | Tenant RLS, no anonymous table writes, current role authorization, capability checks, origin checks, bounded JSON, no-store API responses. Hosted acceptance pending. |
| Concurrent booking | PASS | Seven parallel-connection scenarios: slot collision, duplicate retry, buffers, holds, blocks, queue claims and rate limiting. |
| Chicago time / DST | PASS | Both transitions, invalid/repeated local times, closing buffers and continuous lunch covered. |
| Admin login / permissions | PARTIAL | Owner/manager versus outsider/stylist SQL checks pass; unsigned browser access redirects. Real signed-in owner acceptance pending. |
| Approved menu | PASS | Live 23 services + 15 variants compared with owner snapshot: zero pricing/timing/approval differences. Unclear values remain unapproved. |
| Manual booking / changes | PASS in SQL | Phone/walk-in, idempotency, rescheduling, stale revisions, cancellation, completion and no-show covered. Owner browser acceptance pending. |
| Mobile journey | PARTIAL | Public menu and closed-booking flow inspected at 390px; navigation closure and Escape focus fixed. A hosted reservation has not been completed. |
| Notifications | PASS in tests | Retry/lease, consent, generation, provider idempotency and event deduplication tested. Real delivery/scheduler acceptance pending. |
| Payments off | PASS in tests | Default-off flags, missing-credential failures, signed-event finalization, holds, failed/late payments and refunds covered. No charge made. |
| Accessibility / SEO | PARTIAL | Labels, skip link, focus, reduced motion, canonicals, noindex-by-default and security headers inspected. Screen-reader and authenticated tablet acceptance pending. |
| Secrets / dependencies | PARTIAL | Tracked-history pattern scan clean; production dependency audit clean. Five dev-tool advisory entries remain in the unpatched braces chain. Pattern scanning cannot prove absence of every credential type. |
| Domain / environment | BLOCKED | Production-only Supabase variables exist; preview database, canonical URL and limiter secret are missing. Domain and release acceptance unverified. |
| Abuse / errors | PASS in tests | Atomic shared rate limits; trusted Vercel IP HMACs; safe error references; closed launch gate. WAF, alerts and distributed-bot defense still need deployment configuration. |
| Backup / recovery | DOCUMENTED, UNTESTED | Runbook supplied; a real restore drill and owner retention decisions remain required. |

## Deferred risks — P1

- Review the [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and update when a patched compatible release exists. It affects development lint tooling, not the production dependency tree. Do not run `npm audit fix --force` to downgrade the framework. Build only trusted code/configuration with secrets scoped to trusted releases.
- IP rate limits reduce abuse but do not stop a distributed attacker or IPv6 address rotation. Configure hosting firewall/bot rules and watch 429/5xx rates. Fixed windows can permit a burst across a bucket boundary.
- Customer retention/deletion is an operator procedure, not an automated job. Include snapshots, queued bodies, provider data and backups; never delete an active booking casually.
- Gallery placeholders are intentional. Publish only salon-authorized media and never claim placeholder imagery depicts the salon.
- Keep optional email, SMS, deposits and reminders disabled if their own acceptance is incomplete; they need not block a separately approved no-deposit launch with clear customer communication expectations.
