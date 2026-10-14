import { apiGuard } from "@/lib/api-guard";
import {
  boundedJson,
  RequestProblem,
  logServerFailure,
} from "@/lib/http-safety";
import { privilegedClient } from "@/lib/supabase";
import { bookingSchema } from "@/lib/validation";
import { integrations } from "@/lib/integrations";
import { paymentsReady, smsReady } from "@/lib/integration-config";
import { hashToken } from "@/lib/capabilities";
import { createCheckout, credentialFingerprint } from "@/lib/payments/stripe";
import type { BookingRequest } from "@/lib/payments/core";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const blocked = await apiGuard(req, "bookings", true);
  if (blocked) return blocked;
  let raw;
  try {
    raw = await boundedJson(req);
  } catch (e) {
    return Response.json(
      { error: e instanceof RequestProblem ? e.message : "Invalid request." },
      { status: e instanceof RequestProblem ? e.status : 400 },
    );
  }
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json(
      { error: "Please check your details and selected appointment." },
      { status: 400 },
    );
  try {
    const { request_id, access_token, website: _website, ...b } = parsed.data;
    void _website;
    if (b.sms_consent && !smsReady(integrations))
      return Response.json(
        {
          error:
            "Text messaging is not available. Clear the SMS option to continue.",
        },
        { status: 400 },
      );
    const db = privilegedClient();
    const { data, error } = await db.rpc("begin_booking", {
      p_id: request_id,
      p_token_hash: hashToken(access_token),
      p_booking: b,
      p_fingerprint: paymentsReady(integrations)
        ? credentialFingerprint()
        : null,
      p_livemode: integrations.STRIPE_MODE === "live",
    });
    if (error) {
      if (error.code !== "P0001" && error.code !== "23P01")
        logServerFailure("booking_database_failure", error.code);
      return Response.json(
        {
          error:
            "This time is unavailable or booking configuration needs attention. Choose another time or contact the salon.",
        },
        { status: 409 },
      );
    }
    const r = (Array.isArray(data) ? data[0] : data) as BookingRequest;
    if (!r?.id) throw Error("Invalid booking response");
    if (r.status === "confirmed")
      return Response.json(
        { status: r.status, reference: r.appointment_id, request_id: r.id },
        { status: 201 },
      );
    if (r.status !== "pending" || Date.parse(r.expires_at) <= Date.now())
      return Response.json(
        { error: "This checkout has ended. Please choose a new appointment." },
        { status: 409 },
      );
    if (!paymentsReady(integrations))
      return Response.json(
        { error: "Deposits are temporarily unavailable. Contact the salon." },
        { status: 503 },
      );
    if (r.checkout_url)
      return Response.json({
        status: "pending",
        checkout_url: r.checkout_url,
        request_id: r.id,
        deposit_cents: r.deposit_cents,
        estimate_cents: r.estimate_cents,
        policy: r.policy_snapshot,
      });
    const session = await createCheckout(r);
    const saved = await db.rpc("attach_checkout", {
      p_id: r.id,
      p_session: session.id,
      p_url: session.url,
    });
    if (saved.error || !saved.data) throw Error("Could not attach checkout");
    return Response.json({
      status: "pending",
      checkout_url: session.url,
      request_id: r.id,
      deposit_cents: r.deposit_cents,
      estimate_cents: r.estimate_cents,
      policy: r.policy_snapshot,
    });
  } catch {
    const reference = logServerFailure("booking_processing_failure");
    return Response.json(
      {
        reference,
        error:
          "Booking is temporarily unavailable. Retry this same submission to safely recover it. Unfinished checkout holds expire automatically.",
      },
      { status: 503 },
    );
  }
}
