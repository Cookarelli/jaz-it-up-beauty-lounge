# Communications and optional deposits

This release adds provider adapters and a guarded payment flow. **All external delivery and payments default off.** No provider account, paid resource, real message or real charge is created by installation, migrations, tests or builds. Existing appointments and the confirmed Chicago schedule are preserved.

## Apply and deploy

1. Take a database backup and check migration history. An environment at main `08485ca` needs only `supabase/migrations/20261014184518_communications_and_optional_deposits.sql`. Older environments need their intervening migrations, in order. Do not rerun applied migrations. The migration preserves old notification history, suppresses the unapproved legacy queue and replaces its sender; deploy the matching app immediately after migrating. Old deployed workers cannot claim the new queue.
2. Deploy this commit with Node 24, the public Supabase URL/publishable key, server-only `SUPABASE_SECRET_KEY`, and a canonical HTTPS `NEXT_PUBLIC_SITE_URL`. Separate preview/test and production databases and provider credentials. No credentials belong in Git or database tables.
3. Sign in with an authorized owner at `/admin/login`. Set actual salon phone, email and address under Salon & policies. Approve the remaining service prices/durations before customers can book them.
4. Keep `.env.local` ignored. `.env.example` lists every variable. Resend, Twilio and Stripe keys must never use `NEXT_PUBLIC_`. Build success does not mean any provider or deployment is activated.

## Email setup (Resend)

1. Create/select a Resend account yourself. Verify a salon-owned sending domain with Resend's DNS instructions. Choose a real from address on that domain.
2. Set server variables `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, and a random `NOTIFICATION_LINK_SECRET` of at least 32 characters. Set `EMAIL_PROVIDER=resend` and `NOTIFICATIONS_ENABLED=true` only in the intended deployment.
3. Configure a Resend webhook to `https://YOUR-DOMAIN/api/webhooks/resend` for `email.delivered`, `email.bounced`, `email.complained` and `email.failed`; use its signing secret. The handler validates Svix signatures and deduplicates event IDs. Acceptance is not mislabeled as delivery.
4. Under Admin → Communications, the owner explicitly enables transactional emails. Confirmations, reschedules and cancellations contain service, salon-local date/time, salon name/contact details, a reference, and a signed opt-out link. The template escapes user-provided text and uses cream/teal branding without inventing a logo.
5. Reminders are **disabled** initially. The proposed offsets are `1440,120` minutes (24 hours and 2 hours). The owner can approve or change 1–3 offsets, 30 minutes–7 days. The customer must separately opt into email reminders. Short-notice bookings do not receive a stale immediate reminder. Reschedules replace queued reminders; cancellations suppress them and queue a cancellation message.

Delivery uses persisted bodies, unique job keys, transaction leases, exponential backoff, at most eight attempts and a 23-hour retry cutoff. Resend retains idempotency keys for [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); a potentially accepted email is never automatically retried outside that window. Unknown outcomes need provider reconciliation. Provider/account credential changes during a retry stop delivery for review. A provider-accepted message cannot be recalled if a simultaneous appointment change occurs.

Admin → Communications shows the latest 100 jobs, attempt counts, error codes, provider IDs, and event histories. Safe manual email retries preserve the original body and key and respect the same retry window. It cannot replay unknown or expired messages. Bounce/complaint events suppress later sends to that address. Opt-outs do not cancel appointments. Suppressions are private and are not cleared by another booking or an inbound START message; contact the salon for verified re-consent.

## Optional SMS (Twilio)

Leave `SMS_ENABLED=false` until setup and explicit owner approval. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID`, with a registered/verified sender suitable for the destination country. Set the Messaging Service incoming-message webhook and status callback to `https://YOUR-DOMAIN/api/webhooks/twilio`; enable Advanced Opt-Out and appropriate STOP/HELP responses. The app verifies the signature over the exact canonical URL and form fields, plus account SID. A signed STOP event persists a suppression across future bookings.

The optional booking checkbox is unchecked by default and appears only when the environment and owner setting enable SMS. It explains sender, variable frequency, message/data rates, STOP and that consent is not required for booking. International E.164 phone numbers are required for text consent. Each booking stores consent, capture time and wording version. No historical customer is opted into SMS.

Twilio message creation has no assumed idempotent POST guarantee. A timeout, ambiguous 5xx, or worker crash after claiming SMS becomes `unknown`, requiring reconciliation rather than an automatic resend. Explicitly rejected SMS is `failed`. Provider delivery callbacks supply the final status. This favors avoiding duplicates over silently retrying an uncertain send.

## Scheduling and costs

Run `GET /api/cron/notifications` every five minutes with `Authorization: Bearer <CRON_SECRET>`; use a random secret of at least 32 characters. The worker expires abandoned checkout records and processes at most 10 jobs per channel per call. Database holds become unavailable/available based on their expiration timestamps even if cron is down. Reminder jobs more than 30 minutes overdue are suppressed. Alert on worker non-2xx responses, unknown/failed jobs and backlog; no uptime guarantee is provided by the app itself.

For an approved **Vercel Pro** deployment, merge `deployment/vercel.pro.example.json` into root `vercel.json` and redeploy. Vercel supplies the bearer header from `CRON_SECRET`. There is intentionally no active root cron config: the hosting plan is not yet verified and nothing paid is provisioned. Another trusted HTTPS scheduler can call the same endpoint, with its own availability/costs. A sleeping Mac Mini is unsuitable for reliable production reminders.

Pricing checked October 14, 2026; verify the linked provider pages before buying:

| Service | Relevant costs and limits |
| --- | --- |
| [Vercel plans](https://vercel.com/pricing) / [Hobby restrictions](https://vercel.com/docs/plans/hobby) | Pro starts at $20/month plus applicable usage. A commercial salon needs an appropriate commercial plan; Hobby is for personal, noncommercial use. |
| [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Hobby runs only daily, with hour-level precision, which cannot support these reminders. Pro supports minute-level scheduling. Cron invocations consume function usage; scheduling does not make runtime free. A five-minute schedule is about 8,640 calls per 30 days. |
| [Resend](https://resend.com/pricing) | Free transactional allowance is 3,000 emails/month with 100/day cap; paid plans and excess usage cost extra. Include confirmations, changes and both reminders in volume estimates. |
| [Twilio SMS](https://www.twilio.com/en-us/sms/pricing/us) | Charges include message segments, carrier fees, sender number rental and applicable sender/campaign registration. Unicode and long messages can consume multiple segments. |
| [Stripe](https://stripe.com/pricing) | Standard US domestic online card pricing is 2.9% + 30¢ per successful transaction; other methods/cards, refunds and disputes can have different costs. Do not assume processing fees are returned on refunds. |
| Supabase | Existing plan/database/egress limits still apply. This update does not purchase or change a plan. |

## Stripe setup and activation

Booking remains no-deposit unless all gates pass. Saving a fixed/percentage policy alone cannot activate payments.

1. Use a separate Stripe **test-mode** account environment first. Set `STRIPE_MODE=test`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_WEBHOOK_ENDPOINT_ID`. The key must match the chosen mode. Keep `PAYMENTS_ENABLED=false` during initial setup.
2. Create an HTTPS webhook endpoint at `/api/webhooks/stripe` in the same Stripe account/mode. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`. Use the endpoint's `whsec_` signing secret. The handler accepts only an intact signed raw body and matching mode, and retrieves current Stripe objects server-side before fulfillment.
3. In Admin → Payments click **Verify configured Stripe connection**. It reads the account and endpoint, checks URL/events/mode and live charging capability, and records a credential fingerprint. It does not charge a card or create a Stripe account. Deliver a Stripe dashboard/CLI test webhook to that endpoint; the UI must show a signed webhook received. The API key and signing secret are never stored in the database.
4. Configure the cancellation deadline, clear cancellation/refund terms, fixed cents or an integer percentage, and the refund approach. Amounts are computed from the approved service/variant in Postgres, capped at the estimate, rounded up to cents for percentages, and must be at least 50¢. The browser supplies no price or payment amount. Customers review the deposit and policy before opening hosted Checkout.
5. After test-mode acceptance, configure the intended deployment's server switch `PAYMENTS_ENABLED=true`, and explicitly approve deposits under Admin → Payments. Production needs separate live credentials, `STRIPE_MODE=live`, a live endpoint, a valid signed live-mode webhook and repeated infrastructure verification. Rotate/reverify if keys, secret, endpoint or canonical URL change. Until these conditions are satisfied, enabled-policy bookings fail closed; they do not silently bypass a required deposit.
6. Run a controlled Stripe sandbox acceptance flow before any live activation. This development run uses synthetic SQL events and mocked network calls, not real messages/cards. Live activation and billing require the owner's separate decision.

A random booking request ID and 256-bit capability make browser retries safe. Only its hash is stored; the capability stays in that browser's session storage and is never in return URLs. Checkout creation uses a stable Stripe idempotency key. The booking status endpoint reveals no customer contact information and requires that capability. Returning from Checkout cannot change booking status.

Checkout holds last 35 minutes to accommodate Stripe's [30-minute minimum](https://docs.stripe.com/api/checkout/sessions/create#checkout_session_create-expires_at). Retried creation must occur in the first four minutes; expiration never slides forward. Until the signed webhook proves a complete, paid session with the correct identity, amount, currency and mode, there is no confirmed appointment or confirmation email. Finalization is transactional and locks the stylist; replayed events do not create duplicate visits or messages. Failures, verified expiration and the “End unpaid checkout” action release the slot. An interrupted browser leaves a bounded hold. Failed card attempts may be retried inside Stripe until the session expires.

Late payment after a hold ends never takes a released slot. It becomes `refund_review` and the owner must return the payment in Stripe. If fulfillment conflicts with another appointment, it also becomes `refund_review`. The owner can see all such records under Payments. Webhooks remain processable after the booking payment switch is turned off so existing checkouts can settle safely.

## Cancellation, refunds and balances

The booking stores a policy snapshot, estimated service cost and deposit. Signed payment events record paid amounts; `charge.refunded` reconciles cumulative refunds idempotently. Remaining balance is `max(0, current service estimate - (paid - refunded))`. Cash/other in-salon payments are not inferred or recorded as Stripe collections. A service estimate change never triggers another charge.

Cancellation releases the appointment but never silently issues a refund. The owner reviews the policy accepted at booking and issues full/partial refunds through Stripe's dashboard; authenticated refund webhooks update the record. Refund approach options describe manual review, refundable before deadline, or nonrefundable terms. All are owner-operated, not automatic financial/legal decisions. Late/unfulfilled paid bookings always require refund review. A refund does not itself cancel a confirmed appointment, so the owner must also update its status when appropriate. No card details are handled by this app.

## Tests and remaining acceptance

`npm test` uses fake transports and signed synthetic payloads. `npm run test:db` replays migrations and tests consent, disabled reminders, reminder replacements, claims/leases, immutable retries, deduplication, provider callbacks, capabilities, no-deposit booking, pending Checkout, invalid amounts, paid confirmation, duplicate/late/failed payments, refunds, expiry and tenant authorization. Tests roll back fixture data. PostgreSQL tests run against the disposable GitHub CI database because local PostgreSQL startup is blocked by the desktop sandbox.

Still required before launch: actual provider credentials/domain verification, intended hosting plan and scheduler, owner messaging/payment approvals, published contact/policies, real signed-in owner acceptance, sandbox webhook/Checkout acceptance and operational alerts. No provider delivery, live charge, scheduler installation or hosting deployment is claimed merely because tests pass.
