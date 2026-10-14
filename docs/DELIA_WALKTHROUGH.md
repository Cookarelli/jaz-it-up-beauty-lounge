# Delia’s owner walkthrough

Use synthetic customers in the disposable local test environment for this walkthrough. This is a development demonstration, not a public launch. The temporary operator account is not Delia’s permanent login. No paid features, messages or deposits are enabled.

## A normal salon day

1. Sign in at `/admin/login`. **Today** shows the next visit, today’s appointments and upcoming bookings. The dollar figures are estimates of service value, not money collected.
2. Open **Calendar**. Try Day, Week and Month, select a date, then Today or Previous/Next. Each day shows the salon’s business hours, appointment start/end times and any special closure or time off. Stylist working hours and service buffers can narrow those business hours; a blank calendar is not a promise that every time is bookable.
3. Open an appointment. Check the customer, service, agreed duration, estimate, notes and status. Chemical services already include haircut and style. Do not add them again or charge twice.
4. To reschedule, change the start time and confirm Save changes. Conflicts are rejected. To cancel, choose Cancelled and confirm; history stays and the time becomes available. Complete or No-show is available after the visit’s start time. Closed appointments are retained; create a new appointment instead of reopening one.
5. With messaging disabled, communicate changes directly through your usual customer contact process. A saved appointment is not evidence that an email/text was delivered.

## Phone bookings and walk-ins

1. Open **Customers**, search before adding a duplicate, then add a customer if needed. Use only necessary contact details; email is optional here.
2. Choose **Add appointment**, select the customer, Phone booking or Walk-in, service/variant and stylist.
3. Enter the Chicago start time, confirmed duration and price estimate in cents (`2500` means `$25.00`). Manual bookings can be outside normal hours, but cannot override an appointment, buffer, live checkout hold or manual time block.
4. Confirm, open the saved record and check the calendar. Private notes stay in the admin area.

## Hours and time off

Your confirmed schedule is **Tuesday–Friday 9 AM–7 PM, Saturday 9 AM–3 PM; Sunday and Monday closed**, in **America/Chicago**. There is no scheduled lunch and no automatic gap between visits. Service-specific preparation/cleanup buffers still apply, including at opening and closing. Chicago daylight saving is handled automatically.

- **Hours & time off → Recurring stylist hours:** choose Delia and a weekday. Current times fill in automatically. Edit and save with confirmation.
- **Public business hours:** choose the weekday and update the matching salon opening/closing times. The public calendar uses the intersection of salon and stylist hours. Days omitted from a configured business week are closed. Do not remove the entire business week to close the salon: use a special closure instead.
- **Block time off:** enter start/end and a private reason whenever you need a break. Existing conflicting appointments must be moved first.
- **Special closure or hours:** select a date and the whole salon or a stylist. Special hours narrow the normal day; they do not create an extra open day. Review existing bookings first.
- Changing recurring hours preserves every existing appointment. Check the calendar and contact affected customers before shortening hours. Removing a block/closure may reopen a slot and asks for confirmation.

## Service menu and salon information

Under **Services**, expand the service and its variants. Configure prices, duration, length qualification, availability and optional preparation/cleanup time. Approve a price and duration only when correct. Published services with unresolved values stay visible for consultation but cannot be booked instantly. Archive rather than delete to preserve history. Save errors protect against stale edits from another tab.

Under **Salon & policies**, edit the real contact details, address, social links, homepage wording and cancellation terms. Preview the public pages after saving. Keep **Payments** set to no deposit and all **Communications** switches off for this development phase.

## Details to approve before launch

| Decision | Current position / Delia’s action |
| --- | --- |
| Adult haircuts | Men 30 min / women 60 min; choose each variant’s price within the supplied $20–$30 board range. |
| Kids; beard/mustache | Choose exact/starting prices from $10–$15 / $5–$10 and confirm durations. |
| Design work | Define price, duration and whether it needs consultation. |
| Retouch; foil highlights; two colors | Confirm provisional 90 / 120 / 120 minute durations. Starting prices remain $50 / $75 / $85. |
| Highlight cap; three colors; toner | Confirm durations. Starting prices remain $45 / $95 / $15. |
| Perms | Confirm price and exact duration for each above-shoulder, shoulder-length and below-shoulder variant; current approximately 90–120 minute board guidance is not instant-booking approval. |
| Special occasion pins/braids | Confirm exact duration up to 60 minutes and price/variant qualifications. Curling-only is 30 minutes, from $50. |
| All services | Review the seeded menu and preparation/cleanup buffers. No additional breaks or guessed prices are added. Confirm any later owner edits independently of the original board. |
| Business identity | Supply phone, salon email, street address, approved social links, photos/logo you own and final homepage copy. Current artwork is an intentional placeholder. |
| Appointment rules | Approve advance notice, maximum booking window, cancellation wording and how customers contact the salon for changes while messaging is off. |
| Ownership and privacy | Supply Delia’s email; test her own account, recovery and role revocation. Approve privacy contact, retention period and who maintains backups. |
| Acceptance | Walk through guest reservation, owner phone booking, conflict, time off, reschedule and cancellation with synthetic customers. Review phone/tablet/keyboard use. |
| Launch | After the client has paid, review hosting eligibility, operational configuration, costs and final launch approval separately. A successful test or preview does not authorize public booking. |

The project owner accepts disabled Supabase leaked-password protection as a **temporary Free-plan limitation**. It remains unresolved. Restricted sign-in, unique strong passwords, role checks and RLS remain required. No permissive policy is added to remove informational notices.
