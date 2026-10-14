import { accessBooking } from "@/lib/booking-access";
import { stripeClient } from "@/lib/payments/stripe";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  try {
    const { data, db } = await accessBooking(req);
    if (data.status !== "pending" || !data.stripe_session_id)
      return Response.json(
        {
          error:
            "Contact the salon for a confirmed booking or wait for the hold to expire.",
        },
        { status: 409 },
      );
    const s = await stripeClient().checkout.sessions.expire(
      data.stripe_session_id,
    );
    if (s.status !== "expired") throw Error("Not expired");
    const result = await db.rpc("apply_payment_event", {
      p_event: `server-expire:${s.id}`,
      p_type: "expired",
      p_id: data.id,
      p_session: s.id,
      p_intent: null,
      p_amount: s.amount_total,
      p_currency: s.currency,
      p_livemode: s.livemode,
    });
    if (result.error) throw result.error;
    return Response.json({ status: "expired" });
  } catch {
    return Response.json(
      {
        error:
          "Could not end checkout. Its hold still expires automatically; check payment status before trying again.",
      },
      { status: 409 },
    );
  }
}
