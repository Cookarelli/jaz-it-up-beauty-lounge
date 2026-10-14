import { logServerFailure } from "@/lib/http-safety";
import Stripe from "stripe";
import { verifyStripeEvent } from "@/lib/payments/webhook";
import { integrations } from "@/lib/integrations";
import { stripeConfigured } from "@/lib/integration-config";
import { credentialFingerprint, stripeClient } from "@/lib/payments/stripe";
import { paymentOutcome } from "@/lib/payments/core";
import { privilegedClient } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!stripeConfigured(integrations))
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 1000000) return new Response(null, { status: 413 });
  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(
      raw,
      req.headers.get("stripe-signature") || "",
      integrations.STRIPE_WEBHOOK_SECRET!,
      integrations.STRIPE_MODE === "live",
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.livemode !== (integrations.STRIPE_MODE === "live"))
    return Response.json({ error: "Mode mismatch" }, { status: 400 });
  try {
    const db = privilegedClient(),
      stripe = stripeClient();
    const seen = await db
      .from("payment_readiness")
      .update({ webhook_seen_at: new Date().toISOString() })
      .eq("credential_fingerprint", credentialFingerprint());
    if (seen.error) throw seen.error;
    if (event.type.startsWith("checkout.session.")) {
      const incoming = event.data.object as Stripe.Checkout.Session;
      const s = await stripe.checkout.sessions.retrieve(incoming.id);
      const id = s.metadata?.booking_request_id;
      if (!id) return Response.json({ received: true });
      const outcome = paymentOutcome(s);
      const type =
        outcome === "paid"
          ? "paid"
          : outcome === "expired"
            ? "expired"
            : event.type === "checkout.session.async_payment_failed"
              ? "failed"
              : null;
      if (type) {
        const { error } = await db.rpc("apply_payment_event", {
          p_event: event.id,
          p_type: type,
          p_id: id,
          p_session: s.id,
          p_intent:
            typeof s.payment_intent === "string" ? s.payment_intent : null,
          p_amount: s.amount_total,
          p_currency: s.currency,
          p_livemode: s.livemode,
        });
        if (error) throw error;
      }
    } else if (event.type === "charge.refunded") {
      const charge = await stripe.charges.retrieve(
        (event.data.object as Stripe.Charge).id,
      );
      const intent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null;
      if (intent) {
        const pi = await stripe.paymentIntents.retrieve(intent);
        if (pi.metadata.booking_request_id) {
          const { error } = await db.rpc("apply_refund_event", {
            p_event: event.id,
            p_intent: intent,
            p_refunded: charge.amount_refunded,
          });
          if (error) throw error;
        }
      }
    }
    return Response.json({ received: true });
  } catch {
    logServerFailure("stripe_webhook_processing_failure");
    return Response.json(
      { error: "Event not processed; retry required" },
      { status: 503 },
    );
  }
}
