import Link from "next/link";
import { type Appointment, appointmentTitle } from "@/lib/admin";
import { displayTime, money } from "@/lib/admin-time";
export function AppointmentList({
  appointments,
  timezone,
  empty = "No appointments found.",
}: {
  appointments: Appointment[];
  timezone: string;
  empty?: string;
}) {
  if (!appointments.length) return <p className="notice">{empty}</p>;
  return (
    <div className="appointment-list">
      {appointments.map((a) => (
        <Link
          className="appointment-row"
          key={a.id}
          href={`/admin/appointments/${a.id}`}
        >
          <time dateTime={a.starts_at}>
            {displayTime(a.starts_at, timezone, true)}
          </time>
          <div>
            <strong>{a.client_name}</strong>
            <span>
              {appointmentTitle(a)} · {a.stylists.name}
            </span>
          </div>
          <span className={`badge ${a.status}`}>
            {a.status.replaceAll("_", " ")}
          </span>
          <span>{money(a.price_cents)} est. →</span>
        </Link>
      ))}
    </div>
  );
}
