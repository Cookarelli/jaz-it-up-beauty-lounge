import Link from "next/link";
import {
  adminContext,
  appointmentFields,
  appointmentTitle,
  type Appointment,
} from "@/lib/admin";
import {
  localDate,
  localToISO,
  calendarRange,
  validDate,
  shiftDay,
  displayTime,
  weekdays,
} from "@/lib/admin-time";
import { AppointmentList } from "@/components/admin-appointments";
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; stylist?: string }>;
}) {
  const p = await searchParams;
  const { db, salon } = await adminContext();
  const date =
    p.date && validDate(p.date)
      ? p.date
      : localDate(new Date(), salon.timezone);
  const view = ["day", "week", "month"].includes(p.view || "")
    ? p.view!
    : "week";
  const range = calendarRange(date, view);
  const [staff, bookings, blocks, closures] = await Promise.all([
    db
      .from("stylists")
      .select("id,name,locations!inner(salon_id)")
      .eq("locations.salon_id", salon.id)
      .eq("active", true),
    db
      .from("appointments")
      .select(appointmentFields, { count: "exact" })
      .eq("services.salon_id", salon.id)
      .gte("starts_at", localToISO(range.start + "T00:00", salon.timezone))
      .lt("starts_at", localToISO(range.end + "T00:00", salon.timezone))
      .order("starts_at")
      .limit(1000),
    db
      .from("time_blocks")
      .select("*")
      .eq("salon_id", salon.id)
      .lt("starts_at", localToISO(range.end + "T00:00", salon.timezone))
      .gt("ends_at", localToISO(range.start + "T00:00", salon.timezone)),
    db
      .from("schedule_exceptions")
      .select("*")
      .eq("salon_id", salon.id)
      .gte("on_date", range.start)
      .lt("on_date", range.end),
  ]);
  if (staff.error || bookings.error || blocks.error || closures.error)
    throw Error("Calendar unavailable.");
  const rows = (bookings.data as Appointment[]).filter(
    (a) => !p.stylist || a.stylist_id === p.stylist,
  );
  return (
    <>
      <div className="section-heading">
        <h2>Appointment calendar</h2>
        <Link className="button" href="/admin/appointments/new">
          Add appointment
        </Link>
      </div>
      <form method="get" className="filter-bar">
        <label>
          Date
          <input name="date" type="date" defaultValue={date} />
        </label>
        <label>
          View
          <select name="view" defaultValue={view}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </label>
        <label>
          Stylist
          <select name="stylist" defaultValue={p.stylist || ""}>
            <option value="">All stylists</option>
            {staff.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button>View calendar</button>
      </form>
      <div className="calendar-navigation">
        <Link
          href={`?date=${shiftDay(range.start, -1)}&view=${view}&stylist=${p.stylist || ""}`}
        >
          ← Previous
        </Link>
        <strong>
          {range.start} — {shiftDay(range.end, -1)}
        </strong>
        <Link
          href={`?date=${range.end}&view=${view}&stylist=${p.stylist || ""}`}
        >
          Next →
        </Link>
      </div>
      {(bookings.count || 0) > 1000 && (
        <p role="alert">
          This view exceeds 1,000 appointments. Use the daily view or booking
          search to see every record.
        </p>
      )}
      <div
        className={`calendar-grid ${view}`}
        role="list"
        aria-label={`${view} calendar`}
      >
        {view === "month" &&
          Array.from(
            { length: new Date(range.start + "T12:00Z").getUTCDay() },
            (_, i) => (
              <div
                className="calendar-spacer"
                key={`space-${i}`}
                aria-hidden="true"
              />
            ),
          )}
        {range.days.map((day) => (
          <article
            role="listitem"
            className={`calendar-day ${day === localDate(new Date(), salon.timezone) ? "is-today" : ""}`}
            key={day}
          >
            <h3>
              <Link href={`?date=${day}&view=day`}>
                {weekdays[new Date(day + "T12:00Z").getUTCDay()].slice(0, 3)}{" "}
                {day.slice(5)}
              </Link>
            </h3>
            {closures.data
              .filter(
                (e) =>
                  e.on_date === day &&
                  (!p.stylist || !e.stylist_id || e.stylist_id === p.stylist),
              )
              .map((e) => (
                <p className="calendar-block" key={e.id}>
                  {e.closed
                    ? "Closed"
                    : `Special hours ${e.opens_at.slice(0, 5)}–${e.closes_at.slice(0, 5)}`}{" "}
                  · {e.note}
                </p>
              ))}
            {blocks.data
              .filter(
                (b) =>
                  (!p.stylist || b.stylist_id === p.stylist) &&
                  localDate(b.starts_at, salon.timezone) <= day &&
                  localDate(b.ends_at, salon.timezone) >= day,
              )
              .map((b) => (
                <p className="calendar-block" key={b.id}>
                  Time off · {b.note || "Unavailable"}
                </p>
              ))}
            {view === "day" ? (
              <AppointmentList
                appointments={rows.filter(
                  (a) => localDate(a.starts_at, salon.timezone) === day,
                )}
                timezone={salon.timezone}
              />
            ) : (
              rows
                .filter((a) => localDate(a.starts_at, salon.timezone) === day)
                .map((a) => (
                  <Link
                    className={`calendar-booking ${a.status}`}
                    key={a.id}
                    href={`/admin/appointments/${a.id}`}
                  >
                    <time>{displayTime(a.starts_at, salon.timezone)}</time>
                    <strong>{a.client_name}</strong>
                    <span>{appointmentTitle(a)}</span>
                    <small>{a.status.replaceAll("_", " ")}</small>
                  </Link>
                ))
            )}
          </article>
        ))}
      </div>
    </>
  );
}
