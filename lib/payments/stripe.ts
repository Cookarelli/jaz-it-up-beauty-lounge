import "server-only";
import Stripe from "stripe";
import { integrations } from "../integrations";
import { env } from "../env";
import { hashToken } from "../capabilities";
import { stripeConfigured } from "../integration-config";
import type { BookingRequest } from "./core";
export const stripeEvents = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "charge.refunded",
] as const;
export function stripeClient() {
  if (!stripeConfigured(integrations)) throw Error("Stripe is not configured");
  return new Stripe(integrations.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 2,
    timeout: 10000,
  });
}
export function credentialFingerprint() {
  if (!stripeConfigured(integrations)) return null;
  return hashToken(
    [
      integrations.STRIPE_SECRET_KEY,
      integrations.STRIPE_WEBHOOK_SECRET,
      integrations.STRIPE_WEBHOOK_ENDPOINT_ID,
      env.NEXT_PUBLIC_SITE_URL,
    ].join("|"),
  );
}
export async function createCheckout(r: BookingRequest) {
  const origin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
  if (!origin.startsWith("https://"))
    throw Error("HTTPS site URL required for payments");
  if (Date.now() > Date.parse(r.created_at) + 4 * 60000)
    throw Error("Checkout creation window elapsed");
  // No browser-supplied amount, currency, product name or return URL is accepted.
  return stripeClient().checkout.sessions.create(
    {
      mode: "payment",
      allowed_payment_method_types: ["card"],
      client_reference_id: r.id,
      metadata: { booking_request_id: r.id },
      payment_intent_data: { metadata: { booking_request_id: r.id } },
      customer_email: r.request.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: r.deposit_cents,
            product_data: { name: `Appointment deposit — ${r.item.name}` },
          },
        },
      ],
      expires_at: Math.floor(Date.parse(r.expires_at) / 1000),
      success_url: `${origin}/booking-status?id=${r.id}`,
      cancel_url: `${origin}/booking-status?id=${r.id}&cancelled=1`,
      custom_text: {
        submit: {
          message:
            `${r.policy_snapshot.cancellation_text}\n${r.policy_snapshot.refund_policy}`.slice(
              0,
              1200,
            ),
        },
      },
    },
    { idempotencyKey: `booking-checkout:${r.id}` },
  );
}
export async function verifyStripeInfrastructure() {
  const stripe = stripeClient();
  const [account, endpoint] = await Promise.all([
    stripe.accounts.retrieve(null),
    stripe.webhookEndpoints.retrieve(integrations.STRIPE_WEBHOOK_ENDPOINT_ID!),
  ]);
  const live = integrations.STRIPE_MODE === "live";
  if (
    endpoint.url !==
      `${new URL(env.NEXT_PUBLIC_SITE_URL).origin}/api/webhooks/stripe` ||
    endpoint.status !== "enabled" ||
    endpoint.livemode !== live ||
    !stripeEvents.every(
      (e) =>
        endpoint.enabled_events.includes(e) ||
        endpoint.enabled_events.includes("*"),
    )
  )
    throw Error("Webhook endpoint configuration does not match this app");
  if (live && !account.charges_enabled)
    throw Error("Stripe account cannot accept live payments");
  return {
    account_id: account.id,
    endpoint_id: endpoint.id,
    livemode: live,
    credential_fingerprint: credentialFingerprint()!,
    verified_at: new Date().toISOString(),
  };
}
