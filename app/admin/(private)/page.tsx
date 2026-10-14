import { redirect } from "next/navigation";
import { salonDayBounds } from "@/lib/time";
import { adminClient } from "@/lib/supabase";
import { updateAppointment } from "./actions";
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date || "")
    ? params.date!
    : new Date().toISOString().slice(0, 10);
  const bounds = salonDayBounds(date);
  const db = await adminClient();
  if (!db) redirect("/admin/login");
  const { data, error } = await db!
    .from("appointments")
    .select("*,services(name),stylists(name)")
    .gte("starts_at", bounds.start)
    .lt("starts_at", bounds.end)
    .order("starts_at");
  if (error) throw Error("Calendar unavailable");
  return (
    <>
      <h2>Appointment calendar</h2>
      <form method="get">
        <label>
          Day
          <input name="date" type="date" defaultValue={date} />
        </label>
        <button>View appointments</button>
      </form>
      <p>
        Times displayed in America/Chicago. Confirm the salon timezone before
        launch.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Client</th>
              <th>Service</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((a) => (
              <tr key={a.id}>
                <td>
                  {new Date(a.starts_at).toLocaleTimeString("en-US", {
                    timeZone: "America/Chicago",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  {a.client_name}
                  <br />
                  {a.email}
                  <br />
                  {a.phone}
                </td>
                <td>
                  {a.services?.name}
                  <br />
                  {a.stylists?.name}
                </td>
                <td>{a.status}</td>
                <td>
                  <form action={updateAppointment}>
                    <input type="hidden" name="id" value={a.id} />
                    <select
                      aria-label="Appointment status"
                      name="status"
                      defaultValue={a.status}
                    >
                      <option>confirmed</option>
                      <option>completed</option>
                      <option>cancelled</option>
                    </select>
                    <button>Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data?.length && <p className="notice">No appointments for this day.</p>}
    </>
  );
}
