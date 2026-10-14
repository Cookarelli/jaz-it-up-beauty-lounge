import { apiGuard } from "@/lib/api-guard";
import { accessBooking } from "@/lib/booking-access";
export async function POST(req: Request) {
  const blocked = await apiGuard(req, "status");
  if (blocked) return blocked;
  try {
    const { data, db } = await accessBooking(req);
    if (data.appointment_id) {
      const a = await db
        .from("appointments")
        .select("status,price_cents")
        .eq("id", data.appointment_id)
        .single();
      if (a.error) throw a.error;
      data.status = a.data.status;
      data.estimate_cents = a.data.price_cents;
    }
    return Response.json(
      {
        status:
          data.status === "pending" && Date.parse(data.expires_at) <= Date.now()
            ? "expired"
            : data.status,
        reference: data.appointment_id,
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
