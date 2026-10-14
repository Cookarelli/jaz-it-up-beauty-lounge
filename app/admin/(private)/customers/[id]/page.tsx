import Link from "next/link";
import { notFound } from "next/navigation";
import { adminContext, appointmentFields, type Appointment } from "@/lib/admin";
import { CustomerEditor } from "@/components/customer-editor";
import { AppointmentList } from "@/components/admin-appointments";
export default async function Customer({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const p = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const { db, salon } = await adminContext();
  const [c, a] = await Promise.all([
    db
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salon.id)
      .maybeSingle(),
    db
      .from("appointments")
      .select(appointmentFields, { count: "exact" })
      .eq("customer_id", id)
      .eq("services.salon_id", salon.id)
      .order("starts_at", { ascending: false })
      .range((page - 1) * 50, page * 50 - 1),
  ]);
  if (c.error || a.error) throw Error("Customer history unavailable.");
  if (!c.data) notFound();
  return (
    <>
      <Link href="/admin/customers">← Customers</Link>
      <div className="section-heading">
        <h2>{c.data.name}</h2>
        <Link
          className="button"
          href={`/admin/appointments/new?customer=${id}`}
        >
          Book this customer
        </Link>
      </div>
      <details className="card">
        <summary>Contact details & private notes</summary>
        <CustomerEditor key={c.data.revision} customer={c.data} />
      </details>
      <h3>Appointment history · {a.count}</h3>
      <AppointmentList
        appointments={a.data as Appointment[]}
        timezone={salon.timezone}
      />
      <div className="calendar-navigation">
        {page > 1 && <Link href={`?page=${page - 1}`}>← Previous</Link>}
        <span>Page {page}</span>
        {page * 50 < (a.count || 0) && (
          <Link href={`?page=${page + 1}`}>Next →</Link>
        )}
      </div>
    </>
  );
}
