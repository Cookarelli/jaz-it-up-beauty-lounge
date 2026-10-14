import { adminContext } from "@/lib/admin";
import { weekdays, displayTime, localDate } from "@/lib/admin-time";
import { AdminForm, Field, Notes, Identity } from "@/components/admin-form";
import {
  saveHours,
  addBlock,
  addClosure,
  removeScheduleEntry,
} from "../management-actions";
export default async function Hours() {
  const { db, salon } = await adminContext();
  const [staff, business, working, blocks, exceptions, legacy] =
    await Promise.all([
      db
        .from("stylists")
        .select("id,name,locations!inner(salon_id)")
        .eq("locations.salon_id", salon.id)
        .eq("active", true),
      db
        .from("business_hours")
        .select("*")
        .eq("salon_id", salon.id)
        .order("weekday"),
      db
        .from("working_hours")
        .select("*,stylists(name)")
        .eq("salon_id", salon.id)
        .order("weekday"),
      db
        .from("time_blocks")
        .select("*,stylists(name)")
        .eq("salon_id", salon.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at")
        .limit(200),
      db
        .from("schedule_exceptions")
        .select("*,stylists(name)")
        .eq("salon_id", salon.id)
        .gte("on_date", localDate(new Date(), salon.timezone))
        .order("on_date")
        .limit(200),
      db
        .from("availability")
        .select("*,stylists!inner(name,locations!inner(salon_id))")
        .eq("stylists.locations.salon_id", salon.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at")
        .limit(200),
    ]);
  if (
    [staff, business, working, blocks, exceptions, legacy].some((r) => r.error)
  )
    throw Error("Schedule settings unavailable.");
  const stylistSelect = (all = false) => (
    <label>
      Stylist
      <select name="stylist_id" required={!all}>
        {all && <option value="">Whole salon</option>}
        {staff.data!.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
  const days = (
    <label>
      Day of week
      <select name="weekday">
        {weekdays.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
    </label>
  );
  const remove = (table: string, id: string) => (
    <AdminForm
      action={removeScheduleEntry}
      label="Remove"
      confirm="Remove this schedule entry? This may reopen booking times. Existing appointments will remain."
    >
      <Identity id={id} />
      <input type="hidden" name="table" value={table} />
    </AdminForm>
  );
  return (
    <>
      <h2>Hours & time off</h2>
      <p>
        Set recurring stylist hours to open online appointment times. Business
        hours limit those times when configured. Special closures and time off
        take precedence. Existing appointments keep their booked times when
        recurring hours change.
      </p>
      <p className="notice">
        Booking runs continuously through the working day. No lunch or extra
        breaks are added automatically. Only service preparation and cleanup
        buffers reserve extra time. Use Block time off whenever you need a
        break.
      </p>
      <div className="admin-columns">
        <article className="card">
          <h3>Recurring stylist hours</h3>
          <AdminForm
            action={saveHours}
            label="Save working day"
            confirm="Update this recurring working day? Check existing bookings before shortening hours."
          >
            <input type="hidden" name="kind" value="working" />
            {stylistSelect()}
            {days}
            <Field name="opens_at" label="Starts" type="time" required />
            <Field name="closes_at" label="Ends" type="time" required />
          </AdminForm>
          <h4>Working week</h4>
          {working.data!.map((h) => (
            <div className="schedule-row" key={h.id}>
              <p>
                {h.stylists.name} · {weekdays[h.weekday]}
                <br />
                {h.opens_at.slice(0, 5)}–{h.closes_at.slice(0, 5)}
              </p>
              {remove("working_hours", h.id)}
            </div>
          ))}
          {!working.data!.length && <p>No recurring working hours yet.</p>}
        </article>
        <article className="card">
          <h3>Public business hours</h3>
          <AdminForm
            action={saveHours}
            label="Save business day"
            confirm="Update this business day? These hours appear on the website and limit online booking times."
          >
            <input type="hidden" name="kind" value="business" />
            {days}
            <Field name="opens_at" label="Opens" type="time" required />
            <Field name="closes_at" label="Closes" type="time" required />
          </AdminForm>
          <h4>Published hours</h4>
          {business.data!.map((h) => (
            <div className="schedule-row" key={h.id}>
              <p>
                {weekdays[h.weekday]} · {h.opens_at.slice(0, 5)}–
                {h.closes_at.slice(0, 5)}
              </p>
              {remove("business_hours", h.id)}
            </div>
          ))}
          <p className="muted">
            With any business days configured, omitted days are closed. If you
            remove all business hours, stylist working hours alone define
            bookable times.
          </p>
        </article>
      </div>
      <div className="admin-columns">
        <article className="card">
          <h3>Block time off</h3>
          <AdminForm
            action={addBlock}
            label="Block time"
            confirm="Block this time? Conflicting appointments must be rescheduled or cancelled first."
          >
            {stylistSelect()}
            <Field
              name="starts_at"
              label="From"
              type="datetime-local"
              required
            />
            <Field
              name="ends_at"
              label="Until"
              type="datetime-local"
              required
            />
            <Notes name="note" label="Reason (private)" max={500} />
          </AdminForm>
        </article>
        <article className="card">
          <h3>Special closure or hours</h3>
          <AdminForm
            action={addClosure}
            label="Save special hours"
            confirm="Apply these special hours? Conflicting appointments must be moved first."
          >
            {stylistSelect(true)}
            <Field name="on_date" label="Date" type="date" required />
            <label>
              <span>
                <input name="closed" type="checkbox" defaultChecked />
                Closed all day
              </span>
            </label>
            <Field
              name="opens_at"
              label="Special opening time (if open)"
              type="time"
            />
            <Field
              name="closes_at"
              label="Special closing time (if open)"
              type="time"
            />
            <Notes name="note" label="Reason (private)" max={500} />
          </AdminForm>
          <p className="muted">
            Special hours narrow the working day. They do not open times outside
            the recurring or already published schedule.
          </p>
        </article>
      </div>
      <h3>Upcoming exceptions</h3>
      {blocks.data!.map((b) => (
        <article className="schedule-row card" key={b.id}>
          <p>
            {b.stylists.name} · {displayTime(b.starts_at, salon.timezone, true)}{" "}
            — {displayTime(b.ends_at, salon.timezone, true)}
            <br />
            {b.note}
          </p>
          {remove("time_blocks", b.id)}
        </article>
      ))}
      {exceptions.data!.map((e) => (
        <article className="schedule-row card" key={e.id}>
          <p>
            {e.on_date} · {e.stylists?.name || "Whole salon"} ·{" "}
            {e.closed
              ? "Closed"
              : `${e.opens_at.slice(0, 5)}–${e.closes_at.slice(0, 5)}`}
            <br />
            {e.note}
          </p>
          {remove("schedule_exceptions", e.id)}
        </article>
      ))}
      {!blocks.data!.length && !exceptions.data!.length && (
        <p>No upcoming time off or closures.</p>
      )}
      {!!legacy.data!.length && (
        <>
          <h3>Previously published individual days</h3>
          <p>
            These hours are also bookable. Remove them when replacing them with
            recurring hours.
          </p>
          {legacy.data!.map((a) => (
            <article className="schedule-row card" key={a.id}>
              <p>
                {a.stylists.name} ·{" "}
                {displayTime(a.starts_at, salon.timezone, true)} —{" "}
                {displayTime(a.ends_at, salon.timezone, true)}
              </p>
              {remove("availability", a.id)}
            </article>
          ))}
        </>
      )}
      <p className="muted">
        The next 200 entries of each exception type are shown.
      </p>
    </>
  );
}
