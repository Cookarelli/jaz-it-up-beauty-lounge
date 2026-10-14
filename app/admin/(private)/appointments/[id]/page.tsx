import Link from "next/link";
import { stopMessages } from "../../communications/actions";
import { notFound } from "next/navigation";
import {
  adminContext,
  appointmentFields,
  appointmentTitle,
  type Appointment,
} from "@/lib/admin";
import { displayTime, localInput, money } from "@/lib/admin-time";
import { AdminForm, Field, Notes, Identity } from "@/components/admin-form";
import { editAppointment } from "../../management-actions";
export default async function AppointmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const { db, salon } = await adminContext();
  const r = await db
    .from("appointments")
    .select(appointmentFields)
    .eq("id", id)
    .eq("services.salon_id", salon.id)
    .maybeSingle();
  if (r.error) throw Error("Appointment unavailable.");
  if (!r.data) notFound();
  const a = r.data as Appointment & {
    email_reminders_consent: boolean;
    sms_consent: boolean;
    consent_recorded_at: string | null;
    consent_version: string | null;
  };
  const audit = await db
    .from("audit_logs")
    .select("id,action,created_at,changes")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (audit.error) throw Error("Change history unavailable.");
  return (
    <>
      <Link href="/admin/appointments">← All bookings</Link>
      <h2>{a.client_name}</h2>
      <div className="admin-columns">
        <article className="card">
          <span className={`badge ${a.status}`}>
            {a.status.replaceAll("_", " ")}
          </span>
          <h3>{appointmentTitle(a)}</h3>
          <p>
            {displayTime(a.starts_at, salon.timezone, true)}
            <br />
            {Math.round(
              (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000,
            )}{" "}
            minutes with {a.stylists.name}
          </p>
          <p>
            {money(a.price_cents)} estimated service value. Not a payment
            record.
          </p>
          {a.service_snapshot.includes_cut_style && (
            <p>Haircut and style included in this chemical service.</p>
          )}
          <p>
            {a.email || "No email supplied"}
            <br />
            {a.phone || "No phone supplied"}
            <br />
            Source: {a.source.replaceAll("_", " ")}
          </p>
          {a.customer_id && (
            <Link href={`/admin/customers/${a.customer_id}`}>
              Customer & appointment history →
            </Link>
          )}
          <p>
            <Link href="/admin/payments">Deposit and payment records →</Link>
          </p>
          <p>
            <Link href="/admin/communications">
              Message delivery and consent →
            </Link>
          </p>
          <p className="muted">Reference: {a.id}</p>
        </article>
        <div className="card">
          <h3>Manage appointment</h3>
          <p>
            Reschedules update queued reminders. Confirmed appointments can be
            cancelled, completed, or marked no-show. Closed appointments keep
            their times and prices.
          </p>
          <AdminForm
            key={a.revision}
            action={editAppointment}
            confirm="Save these appointment changes? Rescheduling changes the customer’s booking time. Cancellation releases the appointment slot."
          >
            <Identity id={a.id} revision={a.revision} />
            <Field
              name="starts_at"
              label={`Start (${salon.timezone})`}
              type="datetime-local"
              value={localInput(a.starts_at, salon.timezone)}
              required
            />
            <Field
              name="duration_minutes"
              label="Duration in minutes"
              type="number"
              min={1}
              max={480}
              value={Math.round(
                (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000,
              )}
              required
            />
            <Field
              name="price_cents"
              label="Price estimate in cents"
              type="number"
              min={0}
              max={1000000}
              value={a.price_cents}
              required
            />
            <label>
              Status
              <select name="status" defaultValue={a.status}>
                {(a.status === "confirmed"
                  ? ["confirmed", "cancelled", "completed", "no_show"]
                  : [a.status]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <Notes value={a.notes} />
          </AdminForm>
        </div>
      </div>
      <article className="card">
        <h3>Message consent & preferences</h3>
        <p>
          Email reminders:{" "}
          {a.email_reminders_consent ? "opted in" : "not opted in"}. SMS:{" "}
          {a.sms_consent ? "opted in" : "not opted in"}. Existing opt-outs also
          apply.
        </p>
        {a.consent_recorded_at && (
          <p>
            Recorded {displayTime(a.consent_recorded_at, salon.timezone, true)}{" "}
            · {a.consent_version}
          </p>
        )}
        <AdminForm
          action={stopMessages}
          label="Stop messages"
          confirm="Record the customer’s opt-out and suppress future messages to this contact? This does not cancel their appointment."
        >
          <input type="hidden" name="id" value={a.id} />
          <label>
            Contact channel
            <select name="channel">
              <option value="email">Email</option>
              <option value="sms">Text messages</option>
            </select>
          </label>
        </AdminForm>
      </article>
      <h3>Recent changes</h3>
      <ul>
        {audit.data.map((log) => (
          <li key={log.id}>
            {displayTime(log.created_at, salon.timezone, true)} · {log.action} ·{" "}
            {(log.changes?.fields || []).join(", ")}
          </li>
        ))}
      </ul>
    </>
  );
}
