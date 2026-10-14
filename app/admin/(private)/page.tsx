import Link from "next/link";
import { adminContext, appointmentFields, type Appointment } from "@/lib/admin";
import { localDate, localToISO, shiftDay, money } from "@/lib/admin-time";
import { AppointmentList } from "@/components/admin-appointments";
export default async function Today() {
  const { db, salon } = await adminContext();
  const now = new Date().toISOString(),
    today = localDate(now, salon.timezone);
  const [day, upcoming] = await Promise.all([
    db
      .from("appointments")
      .select(appointmentFields)
      .eq("services.salon_id", salon.id)
      .gte("starts_at", localToISO(today + "T00:00", salon.timezone))
      .lt(
        "starts_at",
        localToISO(shiftDay(today, 1) + "T00:00", salon.timezone),
      )
      .order("starts_at")
      .limit(1000),
    db
      .from("appointments")
      .select(appointmentFields)
      .eq("services.salon_id", salon.id)
      .eq("status", "confirmed")
      .gt("ends_at", now)
      .order("starts_at")
      .limit(6),
  ]);
  if (day.error || upcoming.error)
    throw Error("Dashboard unavailable. Please try again.");
  const visits = day.data as Appointment[],
    next = upcoming.data as Appointment[];
  const kept = visits.filter((a) =>
    ["confirmed", "completed"].includes(a.status),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{today}</span>
          <h2>Today at the lounge</h2>
        </div>
        <Link className="button" href="/admin/appointments/new">
          Add phone booking / walk-in
        </Link>
      </div>
      <div className="metrics">
        <article>
          <span>Appointments today</span>
          <strong>{visits.length}</strong>
        </article>
        <article>
          <span>Completed visits</span>
          <strong>
            {visits.filter((a) => a.status === "completed").length}
          </strong>
        </article>
        <article>
          <span>Today’s estimated service value</span>
          <strong>
            {money(kept.reduce((sum, a) => sum + a.price_cents, 0))}
          </strong>
          <small>Confirmed + completed. Not collected revenue.</small>
        </article>
      </div>
      <h3>Next appointment</h3>
      <AppointmentList
        appointments={next.slice(0, 1)}
        timezone={salon.timezone}
        empty="No upcoming appointments. Your calendar is clear."
      />
      <h3>Today’s schedule</h3>
      <AppointmentList appointments={visits} timezone={salon.timezone} />
      <h3>Coming up</h3>
      <AppointmentList appointments={next.slice(1)} timezone={salon.timezone} />
      <p>
        <Link href="/admin/appointments">Search all bookings →</Link>
      </p>
    </>
  );
}
