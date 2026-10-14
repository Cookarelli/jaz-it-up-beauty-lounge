export function depositAmount(
  estimate: number,
  type: "none" | "fixed" | "percent",
  value: number | null,
) {
  if (!Number.isSafeInteger(estimate) || estimate < 0 || estimate > 1000000)
    throw Error("Invalid estimate");
  if (type === "none") return 0;
  if (
    !Number.isSafeInteger(value) ||
    value! <= 0 ||
    (type === "percent" && value! > 100)
  )
    throw Error("Invalid deposit policy");
  const amount = Math.min(
    estimate,
    type === "fixed" ? value! : Math.ceil((estimate * value!) / 100),
  );
  if (amount < 50) throw Error("Deposit is below Stripe's USD minimum");
  return amount;
}
export function remainingBalance(
  estimate: number,
  paid: number,
  refunded: number,
) {
  return Math.max(0, estimate - (paid - refunded));
}
export function paymentOutcome(session: {
  status: string | null;
  payment_status: string;
}) {
  if (session.status === "complete" && session.payment_status === "paid")
    return "paid";
  if (session.status === "expired") return "expired";
  return "pending";
}
export type BookingRequest = {
  id: string;
  salon_id: string;
  status: string;
  appointment_id: string | null;
  estimate_cents: number;
  deposit_cents: number;
  paid_cents: number;
  refunded_cents: number;
  stripe_session_id: string | null;
  checkout_url: string | null;
  expires_at: string;
  created_at: string;
  livemode: boolean;
  request: { email: string };
  item: { name: string };
  policy_snapshot: { cancellation_text: string; refund_policy: string };
};
