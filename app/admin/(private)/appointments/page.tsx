import Link from "next/link";
import { adminContext, appointmentFields, type Appointment } from "@/lib/admin";
import { localToISO, validDate, shiftDay } from "@/lib/admin-time";
import { AppointmentList } from "@/components/admin-appointments";
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const { db, salon } = await adminContext();
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const q = (p.q || "").replace(/[^a-zA-Z0-9 @+_-]/g, "").slice(0, 100);
  let query = db
    .from("appointments")
    .select(appointmentFields, { count: "exact" })
    .eq("services.salon_id", salon.id)
    .order("starts_at", { ascending: false });
  if (q)
    query = query.or(
      `client_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  if (
    ["confirmed", "completed", "cancelled", "no_show"].includes(p.status || "")
  )
    query = query.eq("status", p.status!);
  if (p.from && validDate(p.from))
    query = query.gte(
      "starts_at",
      localToISO(p.from + "T00:00", salon.timezone),
    );
  if (p.to && validDate(p.to))
    query = query.lt(
      "starts_at",
      localToISO(shiftDay(p.to, 1) + "T00:00", salon.timezone),
    );
  if (p.service && /^[a-f0-9-]{36}$/.test(p.service))
    query = query.eq("service_id", p.service);
  const [r, services] = await Promise.all([
    query.range((page - 1) * 50, page * 50 - 1),
    db
      .from("services")
      .select("id,name")
      .eq("salon_id", salon.id)
      .order("name"),
  ]);
  if (r.error || services.error) throw Error("Bookings unavailable.");
  const link = (n: number) => {
    const s = new URLSearchParams(
      Object.entries(p).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    s.set("page", String(n));
    return `?${s}`;
  };
  return (
    <>
      <div className="section-heading">
        <h2>Bookings</h2>
        <Link className="button" href="/admin/appointments/new">
          Add appointment
        </Link>
      </div>
      <form method="get" className="filter-bar">
        <label>
          Name, email or phone
          <input name="q" defaultValue={p.q} maxLength={100} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={p.status || ""}>
            <option value="">All statuses</option>
            {["confirmed", "completed", "cancelled", "no_show"].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select name="service" defaultValue={p.service || ""}>
            <option value="">All services</option>
            {services.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input name="from" type="date" defaultValue={p.from} />
        </label>
        <label>
          Through
          <input name="to" type="date" defaultValue={p.to} />
        </label>
        <button>Search bookings</button>
      </form>
      <p>{r.count} matching appointments · newest first</p>
      <AppointmentList
        appointments={r.data as Appointment[]}
        timezone={salon.timezone}
      />
      <div className="calendar-navigation">
        {page > 1 && <Link href={link(page - 1)}>← Previous</Link>}
        <span>Page {page}</span>
        {page * 50 < (r.count || 0) && (
          <Link href={link(page + 1)}>Next →</Link>
        )}
      </div>
    </>
  );
}
