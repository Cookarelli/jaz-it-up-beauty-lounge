import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { integrations } from "@/lib/integrations";
import { emailReady, smsReady } from "@/lib/integration-config";
import { AdminForm, Field } from "@/components/admin-form";
import { saveCommunications, retryMessage } from "./actions";
import { displayTime } from "@/lib/admin-time";
export default async function Communications() {
  const { db, salon } = await adminContext();
  const [settings, jobs] = await Promise.all([
    db
      .from("communication_settings")
      .select("*")
      .eq("salon_id", salon.id)
      .single(),
    db
      .from("notification_jobs")
      .select(
        "id,appointment_id,kind,channel,state,due_at,attempts,last_error,provider_id,notification_events(event_type,created_at,detail)",
      )
      .eq("salon_id", salon.id)
      .order("due_at", { ascending: false })
      .limit(100),
  ]);
  if (settings.error || jobs.error)
    throw Error(
      "Communication settings unavailable. Apply the communications migration first.",
    );
  const s = settings.data;
  return (
    <>
      <h2>Appointment communications</h2>
      <p>
        Email provider:{" "}
        {emailReady(integrations)
          ? "configured"
          : "disabled / missing configuration"}
        . SMS:{" "}
        {smsReady(integrations)
          ? "configured"
          : "disabled / missing configuration"}
        .
      </p>
      <article className="card">
        <h3>Owner approval & reminders</h3>
        <p>
          Proposed reminders: 24 hours and 2 hours before a visit. They remain
          disabled until you approve them. Customers must also opt in. Messages
          overdue by more than 30 minutes are skipped, rather than sent late.
        </p>
        <AdminForm
          key={s.revision}
          action={saveCommunications}
          confirm="Save these messaging settings? Enabled channels may send real appointment messages when the scheduled worker runs."
        >
          <input type="hidden" name="revision" value={s.revision} />
          <label>
            <input
              name="email_enabled"
              type="checkbox"
              defaultChecked={s.email_enabled}
            />{" "}
            Enable transactional confirmation, reschedule and cancellation
            emails
          </label>
          <label>
            <input
              name="sms_enabled"
              type="checkbox"
              defaultChecked={s.sms_enabled}
            />{" "}
            Enable texts only for customers who explicitly consented
          </label>
          <label>
            <input
              name="reminders_enabled"
              type="checkbox"
              defaultChecked={s.reminders_enabled}
            />{" "}
            Approve and enable optional reminders
          </label>
          <Field
            name="reminder_minutes"
            label="Reminder minutes before the visit (comma-separated, maximum 3)"
            value={s.reminder_minutes.join(",")}
            required
          />
        </AdminForm>
      </article>
      <h3>Latest 100 delivery jobs</h3>
      <p>
        “Accepted” means the provider accepted the message. “Delivered” requires
        a verified delivery webhook. “Unknown” needs provider reconciliation and
        is never automatically replayed. Disabled or opted-out messages are
        suppressed.
      </p>
      <div className="admin-list">
        {jobs.data.length === 0 && <p>No delivery jobs yet.</p>}
        {jobs.data.map((j) => (
          <article className="card" key={j.id}>
            <h4>
              {j.kind} · {j.channel} · {j.state}
            </h4>
            <p>
              {displayTime(j.due_at, salon.timezone, true)} · {j.attempts}{" "}
              attempts
            </p>
            <Link href={`/admin/appointments/${j.appointment_id}`}>
              Open appointment
            </Link>
            {j.last_error && <p role="status">{j.last_error}</p>}
            <p className="muted">
              Idempotency key: {j.id}
              {j.provider_id && ` · Provider reference: ${j.provider_id}`}
            </p>
            {j.state === "failed" && j.channel === "email" && (
              <AdminForm
                action={retryMessage}
                label="Retry safely"
                confirm="Retry only if still inside the provider’s idempotency window? The original key and body will be reused."
              >
                <input type="hidden" name="id" value={j.id} />
              </AdminForm>
            )}
            <details>
              <summary>Attempt & delivery history</summary>
              <ul>
                {j.notification_events.map((e, i) => (
                  <li key={i}>
                    {displayTime(e.created_at, salon.timezone, true)} ·{" "}
                    {e.event_type}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </>
  );
}
