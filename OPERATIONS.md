# Operating Jaz It Up Beauty Lounge

Start with [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md). Code verification is complete only within the limits recorded there. The salon's hosted booking, owner sign-in, provider delivery and restore drill still need acceptance. Nothing in this document authorizes paid subscriptions, real messages, live payments or public launch.

## GitHub → Mac Mini

Install Git (`xcode-select --install` if needed) and Node 24 LTS from the official Node distribution or an existing version manager. Authenticate to GitHub if the repository is private. Then:

```sh
git clone https://github.com/Cookarelli/jaz-it-up-beauty-lounge.git
cd jaz-it-up-beauty-lounge
git status
git switch main
git pull --ff-only origin main
# If using nvm:
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Skip `nvm` commands if Node is installed another way. Open `http://localhost:3000`. Preserve legitimate local changes before pulling; do not use a hard reset. On subsequent installs, do not overwrite an existing `.env.local`. It is ignored by Git. The Mac must stay awake for local development; it is not the production reminder scheduler. Never expose the local development server publicly.

Validation:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
node scripts/check-secrets.mjs
```

GitHub Quality runs Node 24 and a disposable PostgreSQL 17 service. For local DB tests, use an empty, disposable database named with an `_test` suffix on loopback (or the CI `postgres` host), then run `npm run test:db` followed by `npm run test:concurrency` with `TEST_DATABASE_URL` set securely. The SQL suites roll back fixtures; the concurrency runner deliberately commits synthetic fixtures so independent connections can race. Discard the entire test database afterwards. Never run either against a salon database. Local PostgreSQL could not start in this audit's macOS sandbox; CI supplied the real database checks.

## Environment variables

Use separate Supabase projects and provider test credentials for preview and production. Set Vercel server credentials as Secrets, scoped to the intended environment. Only the three `NEXT_PUBLIC_` values below may appear in browser assets. Do not paste credentials into chat, Git, issue comments, logs or screenshots. Integration-generated names such as `SUPABASE_SERVICE_ROLE_KEY` do not automatically populate the app's `SUPABASE_SECRET_KEY`; configure the exact names below.

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical origin, HTTPS on hosting. Local default `http://localhost:3000`. For preview tests use the exact preview/branch hostname being tested. |
| `NEXT_PUBLIC_SUPABASE_URL` | Intended project's HTTPS URL. Existing salon: `https://fwxothhjxtvuupyeqsri.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key from that same project. RLS remains mandatory. |
| `SUPABASE_SECRET_KEY` | Server-only secret/service-role credential for that project. Needed for guest booking, rate limiter, provider processing and provisioning; never `NEXT_PUBLIC_`. |
| `PUBLIC_BOOKING_ENABLED` | Default `false`. Set `true` only for an approved protected test or accepted release. Also requires database credentials, secure origin and limiter secret. |
| `BOOKING_RATE_LIMIT_SECRET` | Random 32+ characters, server-only. HMACs the trusted request IP; rotation resets client limiter identities. |
| `SITE_INDEXING_ENABLED` | Default `false`. Enable only for the approved public domain/content. Previews remain noindex. |
| `CRON_SECRET` | Random 32+ characters. Required before activating the external notification/checkout cleanup scheduler. |
| `NOTIFICATIONS_ENABLED`, `EMAIL_PROVIDER` | Defaults `false`, `disabled`; choose `resend` only after configuration and owner approval. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` | Server-only Resend sending and signed-delivery settings; verified domain and real sender. |
| `NOTIFICATION_LINK_SECRET` | Random 32+ characters for signed preference links. Rotation invalidates old links; plan support for customers with older messages. |
| `SMS_ENABLED` | Default `false`, independent of email. Requires owner setting and explicit customer consent. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | Optional SMS account, secret and registered messaging service. |
| `PAYMENTS_ENABLED`, `STRIPE_MODE` | Defaults `false`, `test`. Policy is `none` initially. Live activation requires additional owner and verified-webhook gates. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_ENDPOINT_ID` | Server-only, matching Stripe account/mode/endpoint. Never store these in application tables. |
| `ADMIN_AUTH_USER_ID`, `ADMIN_SALON_ID` | Temporary local provisioning inputs only; remove after the operator grants the correct role. |
| `TEST_DATABASE_URL` | Disposable local/CI test database only. Never the salon database. |

Blank optional values are ignored. Boolean switches accept literal `true` or `false`; malformed values fail validation. Restart/redeploy after environment changes. Next.js public values and static robots/sitemap output require a rebuild. Keep production secrets off fork/PR builds. No live credentials are needed in GitHub's test jobs.

## Supabase setup and migrations

The existing project is **Jaz It Up**, reference `fwxothhjxtvuupyeqsri`, organization **OptAImal LLC**. Do not create another production project accidentally. If an isolated test project is needed, the account owner selects its region/plan and approves any cost first; use an empty project with no copied client data. The seed includes the approved service board and confirmed hours, but no real customers or Auth users.

Before any migration: record the deployed app commit and migration list; pause deployments and scheduled workers; keep public booking/messages/payments off; take and verify a recoverable backup. Rehearse the complete history on the empty test project. From a trusted terminal in this repository:

```sh
npx supabase login
npx supabase link --project-ref fwxothhjxtvuupyeqsri
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
# Review project identity and pending filenames before executing:
npx supabase db push --linked --skip-vault
```

For a test project, replace the reference with its explicitly selected ID. Use interactive prompts for credentials, never command-line password arguments. In the existing salon, nine migrations are applied through `20261014182155_delia_confirmed_schedule.sql`; the expected pending files are:

1. `20261014184518_communications_and_optional_deposits.sql`
2. `20261014193528_launch_safety_and_api_limits.sql`

The earlier live migration attempt failed with `Invalid or expired requestState`; read-back confirmed it was not applied. Do not assume the Supabase/Vercel integration applies SQL. Stop if the dry run lists unexpected history. Never use `db reset`, `--include-all`, seed replay or migration-history repair on production as a shortcut. The migrations preserve IDs/history and use forward changes; the communications migration suppresses the legacy unapproved queue. Deploy the matching app before restarting workers.

After applying: re-read history; verify `communication_settings`, `booking_requests`, `payment_readiness`, `api_rate_limits`, RLS and grants; compare salon/staff IDs, hours, appointments and service approvals with the backup. Run the acceptance script on the test project, not test SQL against production. A service-only table with RLS and no client policies is intentionally private; do not add permissive policies to silence an informational advisor. Resolve any real auth/security warning separately.

## Provision Delia and recover access

1. Disable public Auth sign-ups. Set the exact HTTPS site URL and approved redirects for each isolated environment. Review Supabase Auth rate limits and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The live audit reported leaked-password protection disabled; enable if supported by the chosen plan or record the owner-approved alternative.
2. Delia supplies her own email directly to the trusted operator. Create an Auth user using that verified address and a unique random 20+ character password saved in her password manager. Verify ownership before marking confirmed. Delia enters credentials herself; never send a predictable password or a bare account-creation link.
3. Put the verified Auth UUID, salon UUID and server credential in ignored local environment variables. Run `node --env-file=.env.local scripts/provision-admin.mjs`. The script checks an existing confirmed, non-anonymous account and salon, then grants that one owner membership. Remove temporary provisioning variables. No password, invite or email is generated.
4. Test `/admin/login`, private pages, edits and sign-out. Test an unrelated ordinary account against the test project; it must not read customers. Remove the temporary operator owner's membership only after Delia's independent access is verified. Staff roles are salon-scoped; owner/manager can administer, stylist cannot. Every action checks current authorization, even with a still-valid session.

There is currently **no in-app password-reset callback/form or MFA-enforcement flow**. Do not send a recovery link expecting an unimplemented screen to work. Before launch, agree and test an operator-assisted recovery procedure: verify Delia's identity through an established channel, use Supabase's trusted administrative Auth tooling to replace the password with a new unique credential entered/retained securely by Delia, revoke old sessions, and re-test salon authorization. Never log credentials. Consider a separately reviewed recovery/MFA implementation for stronger self-service access. Keep infrastructure-owner accounts protected with provider MFA and a separate recovery method. Do not share Delia's salon login.

## Vercel deployment

The project `jaz-it-up-beauty-lounge` belongs to team `steves-projects-e37a4ef4` and is linked to this GitHub repository. The connector's project-detail API returned a team authorization error; browser access confirmed the project and the team's current Hobby plan. A suitable commercial plan remains a launch requirement; no upgrade was made. The Supabase integration supplied the public URL/key and server secret with **Production-only** scope. Preview has no database variables. The canonical site URL and rate-limit secret are still missing. Verify current settings in the dashboard rather than treating integration connection as deployment success.

1. Use the intended team and an owner-approved commercial hosting plan. Root directory is the repository root, framework Next.js, Node 24, install `npm ci`, build `npm run build`. No paid upgrade is performed by these instructions.
2. Before pushing `main`, retain the repository's `vercel.json` rule `git.deploymentEnabled.main=false`. This blocks automatic main-branch deployments while leaving branch previews enabled ([Vercel configuration](https://vercel.com/docs/project-configuration/git-configuration)). Remove this rule only in a separately approved release after P0 acceptance; it does not prevent someone explicitly deploying production from the CLI/dashboard. Keep preview creation enabled for the audit branch. Protect previews with Vercel Authentication; do not disable protection to make a test pass.
3. Scope preview variables to the isolated test project and test provider accounts. Production gets the live project only. Keep all release/integration flags off initially. Set the exact preview canonical URL and approved Auth redirect before testing; a stable branch hostname is useful.
4. Deploy the reviewed branch as **Preview**, verify its Git SHA and READY status, inspect build/runtime logs and run the script below. A green build is not a successful booking test. Do not promote a release with unchecked P0 items.
5. After owner approval, connect the actual domain, verify DNS/TLS, canonical redirects, exact origin, Auth redirects and provider webhook URLs. Rebuild with the release environment. Stage/test the production build before assigning the public domain. Re-run booking gate/security smoke tests after release.
6. Enable booking and indexing only at their explicit checklist steps. Keep the server's public booking gate off to pause new online reservations during an incident; existing owner management remains available. Payment webhooks must continue settling already-created checkouts safely.

No root cron configuration is active. For an approved Vercel Pro deployment, review `deployment/vercel.pro.example.json` and merge it into `vercel.json` only when providers and owner settings are accepted. It calls `/api/cron/notifications` every five minutes with the configured bearer secret. Another trusted HTTPS scheduler is possible. Do not put the secret into a URL. Monitor each invocation; a sleeping Mac Mini cannot guarantee reminders.

## Protected preview acceptance script

Use synthetic names and `example.invalid` addresses with all messaging and payments disabled. Do not make test reservations on the production salon calendar. Record preview URL, deployed SHA, test project ID, appointment references and results in a private release record. Delete the disposable environment according to its approved lifecycle, not arbitrary production records.

1. Open Home → Services → Book at 390px and tablet size. Confirm meaningful labels, visible keyboard focus, menu closure, no overflow and clear loading/errors. Check reduced motion, zoom and a screen reader. Review every public page, metadata and gallery disclosures.
2. In the protected test deployment only, enable booking with its limiter secret and migrated test database. Choose a fully approved service, a Chicago date and an available time; enter synthetic contact details and submit. Verify exactly one appointment in the authorized dashboard, matching service/variant, integer-cent estimate, local time and full buffered duration. No message or Checkout should occur.
3. Retry the same submission and simulate a network interruption; verify one appointment/reference. In separate browser sessions try the same slot concurrently; only one succeeds. Confirm overlapping buffers are unavailable and adjacent zero-buffer appointments are allowed.
4. Test Tuesday–Friday 09:00–19:00 and Saturday 09:00–15:00, Sunday/Monday closed, continuous lunch, latest fitting closing slot, and dates on both sides of DST. No time is silently converted to a different local hour.
5. Sign in as the test owner. Add phone/walk-in bookings, inspect customer history, reschedule with confirmation, reject a stale edit/conflict, cancel and verify the slot reopens; complete/mark no-show only after start. Add/remove time off, change recurring hours and special closures, preserve existing appointments. Edit/approve a draft variant and verify its public eligibility. Reports must say estimates, not collected revenue.
6. Sign out and attempt customer/admin URLs and actions; repeat as an unrelated authenticated user. Neither may see client records. Check invalid origins, oversized bodies, expired capabilities and rate limits; errors must reveal no contacts or secrets.
7. Only after separate channel approval, use controlled recipient/provider sandbox tests for confirmations, changes, opt-outs, reminders, duplicate cron invocations, signature failures and provider callbacks. Test Stripe sandbox Checkout completion, failed/expired/interrupted attempts, webhook retries, refund review and released holds. Do not use a real card or send to a customer.
8. Record the results. Any failed/untested essential step blocks public activation; disable the test booking switch afterward if the environment is no longer in active acceptance.

## Delia's everyday dashboard

| Task | Where / behavior |
| --- | --- |
| Today's visits / next appointment | `/admin`: upcoming list and estimated service value. |
| Calendar | Day/week/month; local Chicago times, stylist/date filters and block/closure indicators. |
| Phone booking or walk-in | Customers → add/select customer, then Bookings → add. Confirm agreed service, duration and estimate. Email optional. Manual bookings can be outside recurring hours but cannot override conflicts/blocks/closures/holds. |
| Reschedule/cancel/complete/no-show | Open booking; review details and confirm the action. Cancel preserves history and releases the slot. Closed bookings cannot be reopened; create a new visit. |
| Time off / working week | Hours & time off. Tue–Fri 9–7, Sat 9–3; Sun/Mon closed. No automatic lunch or inter-appointment break. Move existing appointments before adding a conflicting closure/block. |
| Services | Edit cents, durations, variants, category, status, buffers and approvals. Board ranges/TBD durations stay visible but unbookable. Chemical bundles include haircut/style once. Archive rather than delete. |
| Customers | Search, notes and appointment history. Avoid medical/sensitive notes. Historical appointment contact snapshots are preserved when the profile changes. |
| Salon & policies | Contact/address/social/homepage content, public business hours and cancellation wording. Removing all business hours allows stylist-only availability; review the UI warning carefully. |
| Communications / payments | Private delivery/retry/error history and optional policy settings. Payment refunds are manually issued in Stripe, then reconciled by signed webhook. |
| Reports / change history | Estimated service value and volume; not collected revenue. Audit logs retain actor/entity/revision metadata. |

## Providers, consent and optional deposits

Follow [COMMUNICATIONS_PAYMENTS.md](docs/COMMUNICATIONS_PAYMENTS.md) for exact webhook events and activation gates. Email uses Resend with verified DNS/sender and Svix signatures. SMS uses Twilio with sender registration, exact canonical callback URL, signatures and STOP suppression. Reminders are off by default; proposals are 1,440 and 120 minutes. Email-reminder and SMS consent are separate, optional and recorded with time/version. Opt-out never cancels a booking; do not clear a suppression without verified re-consent.

The outbox uses unique job keys, immutable persisted content, leases, bounded retries and delivery events. Resend retries stop before its 24-hour idempotency window expires. Twilio ambiguous outcomes are `unknown` and require provider reconciliation. Admin logs distinguish accepted from delivered; investigate bounce/complaint/unknown/failed records instead of resending blindly. Scheduled jobs process bounded batches; alert on backlog and non-2xx cron results.

Deposits remain policy `none` with `PAYMENTS_ENABLED=false`. Optional fixed cents/percentage amounts come from approved server-side prices. Stripe connection verification, signed webhook receipt and explicit owner approval are all required. The Checkout browser return cannot confirm a booking. Holds expire, late paid requests become refund review, and retries deduplicate by event/request IDs. No card data or secret is stored in the database. Owner cancellation does not automatically refund; review the accepted policy in Stripe and reconcile signed refund events.

## Privacy, retention and monitoring

Delia must approve and publish the purpose, contact method, providers and retention period before launch. The current privacy page is a draft requiring those details; no legal compliance certification is claimed. Keep notes minimal. Customer information exists in `customers`, appointment snapshots, booking-request inputs, notification-job payload/rendered content, provider systems and backups. Deleting only a customer row is not complete erasure.

There is no automated customer-retention purge. Assign a trusted operator to verify correction/export/deletion requests, check active appointments/financial record obligations, prepare a scoped transaction or redaction migration, take a protected backup, review the affected rows and retain an audit of the request without copying contact data. Redact all applicable snapshots and payload copies while preserving required transaction/audit integrity; request provider deletion as appropriate. Define backup expiry and replay pending erasure requests after restoration. Have qualified advice on applicable retention/consent requirements rather than inventing a legal period.

Rate limiting stores keyed IP hashes, not raw addresses: booking 5/minute + 20/hour; availability 60/300; status 90/900; cancellation/preferences 10/40. The service-only table atomically shares limits across functions. Requests opportunistically remove up to 500 expired rows older than 24 hours; idle systems may retain old hashes longer, so schedule reviewed cleanup if an exact retention deadline is required. Vercel's trusted forwarding header is used; outside Vercel only loopback is supported until a trusted-proxy adapter is reviewed. Add platform bot/firewall protections for distributed abuse and monitor rejection rates without logging raw bodies, tokens or customer contacts.

Application errors log static event names, safe codes and random references. Configure Vercel error/availability alerts and a recipient; review Supabase database/Auth alerts and provider bounces. Never dump requests, env values or customer rows into error tracking. Before launch, test the alert path, document who responds, set budgets/usage notifications and choose log retention/access. The app itself does not create external monitoring accounts.

## Backup, rollback and recovery

Follow [Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups). Confirm the actual plan and last successful backup; free projects do not include managed automatic backups. Pro daily backups retain seven days. Database backups do not contain Storage object contents, and custom-role passwords need separate handling. If exporting, use the official complete backup procedure covering application schema/data, Auth identities, roles/grants and migration history; a default schema-only `db dump` is not a complete recovery backup. Encrypt exports, store them off the Mac and outside Git, restrict access and test restoration. Separately inventory Storage/media, provider configuration, domains, webhook endpoints and secrets in an approved password manager.

Proposed operating targets, pending owner approval: daily verified backup; recovery drill before launch and quarterly; target at most 24 hours of data loss and four hours to restore. These are goals, not a measured guarantee; tighter requirements may require paid PITR and monitoring. Record the restored appointment count, catalog, roles/RLS, schedule and migration history during the drill.

If an incident occurs:

1. Turn public booking and outbound channels off, pause the scheduler, and protect the site. Preserve evidence and record the last good commit/migration and incident time. Keep authenticated payment reconciliation available or arrange provider-event replay; disabling checkout creation alone must not discard already-paid events.
2. For a code-only defect with a compatible schema, use Vercel's verified prior build/rollback process. Do not assume reverting Git reverses the database. Check that old code cannot replay the superseded notification queue or misinterpret payment records.
3. For a schema/data problem, prefer a reviewed forward repair. Do not drop columns/tables or run reset. If restoration is necessary, restore the verified backup into an isolated project first, replay the correct migrations and compare records before switching runtime credentials. A full restore may lose bookings after the backup; reconcile with the owner and provider evidence.
4. Before workers restart, reconcile notification IDs/accepted deliveries, opt-outs, payment events/refunds and checkout holds against providers. A restored older queue could otherwise resend messages or forget payments. Do not replay unknown SMS or expired email idempotency keys blindly. Reapply verified customer-erasure requests.
5. Re-provision correct configuration, re-run RLS/admin/booking/DST checks, verify alerts and obtain owner approval to reopen. Rotate exposed credentials and revoke sessions if a security incident occurred. Document cause, affected interval and follow-up.

## Expected recurring costs

Indicative US pricing checked October 14, 2026; no plan was purchased or upgraded in this audit. Verify provider pages before committing. Existing billing plans and usage have not been approved here.

| Provider | Planning allowance / limitation |
| --- | --- |
| [Vercel](https://vercel.com/pricing) | Pro starts at $20/month plus applicable usage/seats. [Hobby is noncommercial](https://vercel.com/docs/plans/hobby); choose an appropriate commercial plan for the salon. |
| [Supabase](https://supabase.com/pricing) | Pro starts at $25/month, with compute credits sufficient for one Micro instance; extra projects/compute/usage add cost. Free can pause after inactivity and has no automatic backups. |
| [Scheduling](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Five-minute cadence ≈8,640 function calls/30 days. Pro supports minute scheduling; Hobby daily scheduling is inadequate. Calls still consume usage. |
| [Resend](https://resend.com/pricing) | Free allowance 3,000/month, 100/day; paid tier/overage as volume grows. Include confirmations, changes and two reminders. |
| [Twilio](https://www.twilio.com/en-us/sms/pricing/us) | Optional per-segment charges, carrier fees, number rental and sender registration; no flat total assumed. |
| [Stripe](https://stripe.com/pricing) | Optional standard domestic US online card rate 2.9% + 30¢/successful charge; other card types, refunds and disputes differ. |
| Domain / recovery / monitoring | Domain renewal, email mailbox, backup storage, extra test project and optional alert/PITR services cost separately. |

A single small production project on the starting Vercel Pro + Supabase Pro tiers is roughly **$45/month before tax, domain, extra seats/projects, provider charges and usage**. This is a planning baseline, not a quote or authorization to buy.
