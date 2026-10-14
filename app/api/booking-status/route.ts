import { apiGuard } from "@/lib/api-guard";
import { accessBooking } from "@/lib/booking-access";
export async function POST(req: Request) {
  const blocked = await apiGuard(req, "status");
  if (blocked) return blocked;
  try {
    const { data, db } = await accessBooking(req);
    let appointment = null;
    if (data.appointment_id) {
      const a = await db
        .from("appointments")
        .select(
          "status,price_cents,starts_at,ends_at,service_snapshot,services!inner(name),stylists!inner(locations!inner(timezone))",
        )
        .eq("id", data.appointment_id)
        .single();
      if (a.error) throw a.error;
      const saved = a.data as unknown as {
        status: string;
        price_cents: number;
        starts_at: string;
        ends_at: string;
        service_snapshot: { name?: string; includes_cut_style?: boolean };
        services: { name: string };
        stylists: { locations: { timezone: string } };
      };
      data.status = saved.status;
      data.estimate_cents = saved.price_cents;
      appointment = {
        starts_at: saved.starts_at,
        ends_at: saved.ends_at,
        service: saved.service_snapshot?.name || saved.services.name,
        includes_cut_style: saved.service_snapshot?.includes_cut_style === true,
        timezone: saved.stylists.locations.timezone,
      };
    }
    return Response.json(
      {
        status:
          data.status === "pending" && Date.parse(data.expires_at) <= Date.now()
            ? "expired"
            : data.status,
        reference: data.appointment_id,
        appointment,
        estimate_cents: data.estimate_cents,
        deposit_cents: data.deposit_cents,
        paid_cents: data.paid_cents,
        refunded_cents: data.refunded_cents,
        expires_at: data.expires_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Booking status could not be verified on this browser." },
      { status: 404 },
    );
  }
}
