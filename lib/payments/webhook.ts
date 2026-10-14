import Stripe from "stripe";
export function verifyStripeEvent(
  raw: string,
  signature: string,
  secret: string,
  live: boolean,
) {
  const event = Stripe.webhooks.constructEvent(raw, signature, secret);
  if (event.livemode !== live) throw Error("Mode mismatch");
  return event;
}
