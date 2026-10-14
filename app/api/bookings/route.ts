import { privilegedClient } from "@/lib/supabase";
import { bookingSchema } from "@/lib/validation";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 8000)
    return Response.json({ error: "Request too large." }, { status: 413 });
  let raw;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json(
      { error: "Please check your details and selected appointment." },
      { status: 400 },
    );
  try {
    const b = parsed.data;
    const { data, error } = await privilegedClient().rpc(
      "reserve_appointment",
      {
        p_service: b.service_id,
        p_stylist: b.stylist_id,
        p_start: b.starts_at,
        p_name: b.name,
        p_email: b.email,
        p_phone: b.phone,
      },
    );
    if (error)
      return Response.json(
        {
          error:
            "This time is no longer available, or you have recently booked. Please select another time.",
        },
        { status: 409 },
      );
    return Response.json({ reference: data }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Booking is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
