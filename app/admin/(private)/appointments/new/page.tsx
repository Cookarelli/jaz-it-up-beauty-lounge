import Link from "next/link";
import { adminContext } from "@/lib/admin";
import type { Service } from "@/lib/service-types";
import { ManualBooking } from "@/components/manual-booking";
export default async function NewAppointment({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; q?: string }>;
}) {
  const p = await searchParams;
  const { db, salon } = await adminContext();
  let query = db
    .from("customers")
    .select("id,name,phone")
    .eq("salon_id", salon.id)
    .order("name")
    .limit(100);
  if (p.customer && /^[a-f0-9-]{36}$/.test(p.customer))
    query = query.eq("id", p.customer);
  else if (p.q) query = query.ilike("name", `%${p.q.slice(0, 100)}%`);
  const [s, v, c, st] = await Promise.all([
    db
      .from("services")
      .select("*")
      .eq("salon_id", salon.id)
      .neq("status", "archived")
      .eq("active", true)
      .order("display_order"),
    db
      .from("service_variants")
      .select("*")
      .eq("salon_id", salon.id)
      .neq("status", "archived"),
    query,
    db
      .from("stylists")
      .select("id,name,locations!inner(salon_id)")
      .eq("locations.salon_id", salon.id)
      .eq("active", true),
  ]);
  if (s.error || v.error || c.error || st.error)
    throw Error("Booking form unavailable.");
  const services = (s.data as Service[]).map((s) => ({
    ...s,
    variants: (v.data as Service[]).filter((v) => v.service_id === s.id),
  }));
  return (
    <>
      <h2>Add a phone booking or walk-in</h2>
      <p>
        Choose an existing customer or{" "}
        <Link href="/admin/customers/new">add a customer first</Link>. Email is
        optional for manual bookings.
      </p>
      <form method="get" className="filter-bar">
        <label>
          Find customer by name
          <input name="q" defaultValue={p.q} />
        </label>
        <button>Find customer</button>
      </form>
      <p className="muted">
        Up to 100 matching customers shown. Search to narrow the list.
      </p>
      <div className="card">
        <ManualBooking
          services={services}
          customers={c.data}
          stylists={st.data}
          requestId={crypto.randomUUID()}
          timezone={salon.timezone}
          customerId={p.customer || ""}
        />
      </div>
    </>
  );
}
