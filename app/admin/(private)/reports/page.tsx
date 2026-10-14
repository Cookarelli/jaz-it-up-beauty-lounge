import { adminContext } from "@/lib/admin";
import {
  localDate,
  validDate,
  shiftDay,
  localToISO,
  money,
} from "@/lib/admin-time";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const p = await searchParams;
  const { db, salon } = await adminContext();
  const today = localDate(new Date(), salon.timezone),
    from = p.from && validDate(p.from) ? p.from : today.slice(0, 7) + "-01",
    to = p.to && validDate(p.to) ? p.to : today;
  const r = await db.rpc("admin_report", {
    p_salon: salon.id,
    p_from: localToISO(from + "T00:00", salon.timezone),
    p_to: localToISO(shiftDay(to, 1) + "T00:00", salon.timezone),
  });
  if (r.error)
    throw Error(
      "Report unavailable. Choose a valid date range up to one year.",
    );
  const rows = r.data as {
      status: string;
      visits: number;
      estimated_cents: number;
    }[],
    kept = rows.filter((x) => ["confirmed", "completed"].includes(x.status));
  return (
    <>
      <h2>Appointment reports</h2>
      <form method="get" className="filter-bar">
        <label>
          From
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          Through
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button>Run report</button>
      </form>
      <p className="notice">
        These figures use appointment price estimates. They are not collected
        revenue, paid invoices, profit, or tax reports. Payments and deposits
        are disabled.
      </p>
      <div className="metrics">
        <article>
          <span>All appointments</span>
          <strong>{rows.reduce((sum, r) => sum + Number(r.visits), 0)}</strong>
        </article>
        <article>
          <span>Confirmed + completed estimates</span>
          <strong>
            {money(kept.reduce((sum, r) => sum + Number(r.estimated_cents), 0))}
          </strong>
        </article>
        <article>
          <span>Collected revenue</span>
          <strong>Not tracked</strong>
        </article>
      </div>
      <div className="table-wrap">
        <table>
          <caption>
            Appointments starting {from} through {to}, by status
          </caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Appointment volume</th>
              <th scope="col">Estimated service value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status}>
                <th scope="row">{r.status.replaceAll("_", " ")}</th>
                <td>{r.visits}</td>
                <td>{money(Number(r.estimated_cents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No appointments in this period.</p>}
    </>
  );
}
