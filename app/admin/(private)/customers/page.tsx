import Link from "next/link";
import { adminContext } from "@/lib/admin";
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const p = await searchParams;
  const { db, salon } = await adminContext();
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1)),
    q = (p.q || "").replace(/[^a-zA-Z0-9 @+_-]/g, "").slice(0, 100);
  let query = db
    .from("customers")
    .select("id,name,email,phone", { count: "exact" })
    .eq("salon_id", salon.id)
    .order("name");
  if (q)
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  const r = await query.range((page - 1) * 50, page * 50 - 1);
  if (r.error) throw Error("Customers unavailable.");
  return (
    <>
      <div className="section-heading">
        <h2>Customers</h2>
        <Link className="button" href="/admin/customers/new">
          Add customer
        </Link>
      </div>
      <form method="get" className="filter-bar">
        <label>
          Name, email or phone
          <input name="q" defaultValue={p.q} />
        </label>
        <button>Search customers</button>
      </form>
      <p>{r.count} matching customers</p>
      <div className="appointment-list">
        {r.data.map((c) => (
          <Link
            className="appointment-row"
            key={c.id}
            href={`/admin/customers/${c.id}`}
          >
            <strong>{c.name}</strong>
            <span>{c.email || "No email"}</span>
            <span>{c.phone || "No phone"}</span>
            <span>Open history →</span>
          </Link>
        ))}
      </div>
      <div className="calendar-navigation">
        {page > 1 && (
          <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>
            ← Previous
          </Link>
        )}
        <span>Page {page}</span>
        {page * 50 < (r.count || 0) && (
          <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>
            Next →
          </Link>
        )}
      </div>
    </>
  );
}
