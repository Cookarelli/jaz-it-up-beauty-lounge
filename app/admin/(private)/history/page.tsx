import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { displayTime } from "@/lib/admin-time";
export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const { db, salon } = await adminContext();
  const r = await db
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("salon_id", salon.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (r.error) throw Error("History unavailable.");
  return (
    <>
      <h2>Change history</h2>
      <p>
        Append-only records show who changed the salon and when. Customer
        contact details and private notes are excluded from audit payloads.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Record</th>
              <th scope="col">Action</th>
              <th scope="col">Actor / changed fields</th>
            </tr>
          </thead>
          <tbody>
            {r.data.map((a) => (
              <tr key={a.id}>
                <td>{displayTime(a.created_at, salon.timezone, true)}</td>
                <td>
                  {a.entity_type}
                  <br />
                  <small>{a.entity_id}</small>
                </td>
                <td>
                  {a.action}
                  {a.revision ? ` · revision ${a.revision}` : ""}
                </td>
                <td>
                  <small>{a.actor_id || "System / migration"}</small>
                  <br />
                  {(a.changes?.fields || []).join(", ")}
                  {Object.keys(a.changes || {}).some((k) => k !== "fields") && (
                    <details>
                      <summary>Changed scheduling values</summary>
                      <pre>
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(a.changes).filter(
                              ([k]) => k !== "fields",
                            ),
                          ),
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="calendar-navigation">
        {page > 1 && <Link href={`?page=${page - 1}`}>← Previous</Link>}
        <span>Page {page}</span>
        {page * 50 < (r.count || 0) && (
          <Link href={`?page=${page + 1}`}>Next →</Link>
        )}
      </div>
    </>
  );
}
