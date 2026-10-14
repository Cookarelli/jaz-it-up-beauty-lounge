import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { AdminForm, Field, Notes } from "@/components/admin-form";
import { savePayments, verifyPayments } from "../communications/actions";
import { money, displayTime } from "@/lib/admin-time";
import { remainingBalance } from "@/lib/payments/core";
import { integrations } from "@/lib/integrations";
import { paymentsReady } from "@/lib/integration-config";
export default async function Payments() {
  const { db, salon } = await adminContext();
  const [policy, ready, requests] = await Promise.all([
    db.from("booking_policies").select("*").eq("salon_id", salon.id).single(),
    db
      .from("payment_readiness")
      .select("account_id,livemode,verified_at,webhook_seen_at")
      .eq("salon_id", salon.id)
      .maybeSingle(),
    db
      .from("booking_requests")
      .select(
        "id,status,appointment_id,created_at,estimate_cents,deposit_cents,paid_cents,refunded_cents,stripe_payment_intent,last_error,policy_snapshot,appointments(price_cents,status)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (policy.error || requests.error || ready.error)
    throw Error("Payment settings unavailable.");
  const p = policy.data;
  return (
    <>
      <h2>Optional deposits & payment records</h2>
      <p className="notice">
        Booking has no deposit by default. Payments require the server switch,
        verified Stripe infrastructure, a received signed webhook, and your
        explicit approval. Current Stripe mode: {integrations.STRIPE_MODE}.
        Server activation:{" "}
        {paymentsReady(integrations) ? "ready" : "disabled or incomplete"}.
      </p>
      <article className="card">
        <h3>Connection checks</h3>
        <p>
          Account: {ready.data?.account_id || "not verified"}. Endpoint
          verified: {ready.data?.verified_at ? "yes" : "no"}. Signed webhook
          received: {ready.data?.webhook_seen_at ? "yes" : "no"}.
        </p>
        <AdminForm
          action={verifyPayments}
          label="Verify configured Stripe connection"
        >
          <p>
            This checks existing credentials and endpoint settings. It creates
            no account or charge.
          </p>
        </AdminForm>
      </article>
      <article className="card">
        <h3>Owner payment policy</h3>
        <AdminForm
          key={p.revision}
          action={savePayments}
          confirm="Save this deposit and refund policy? Enabling deposits changes new online bookings; existing appointments are preserved."
        >
          <input type="hidden" name="revision" value={p.revision} />
          {[
            "minimum_notice_minutes",
            "maximum_advance_days",
            "slot_interval_minutes",
          ].map((k) => (
            <input type="hidden" key={k} name={k} value={p[k]} />
          ))}
          <label>
            Deposit type
            <select name="deposit_type" defaultValue={p.deposit_type}>
              <option value="none">None</option>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percentage of estimate</option>
            </select>
          </label>
          <Field
            name="deposit_value"
            label="Fixed cents or percent (leave blank for none)"
            type="number"
            value={p.deposit_value}
            min={0}
            max={1000000}
          />
          <Field
            name="cancellation_notice_hours"
            label="Cancellation deadline (hours before visit)"
            type="number"
            min={0}
            max={8760}
            value={p.cancellation_notice_hours}
          />
          <Notes
            name="cancellation_text"
            label="Customer-facing cancellation terms"
            max={3000}
            value={p.cancellation_text}
          />
          <label>
            Refund approach
            <select name="refund_mode" defaultValue={p.refund_mode}>
              <option value="manual_review">Owner reviews every request</option>
              <option value="refundable_before_deadline">
                Refundable before the cancellation deadline
              </option>
              <option value="nonrefundable">
                Nonrefundable under the published terms
              </option>
            </select>
          </label>
          <Notes
            name="refund_policy"
            label="Customer-facing refund terms (required before activation)"
            max={3000}
            value={p.refund_policy}
          />
          <p>
            Refunds are reviewed and issued by the owner in Stripe. Cancelling a
            booking does not issue a refund. Late payments for released slots
            always require a refund review, regardless of the normal
            cancellation policy. Refunded amounts return through signed
            webhooks.
          </p>
          <label>
            <input
              name="payments_enabled"
              type="checkbox"
              defaultChecked={p.payments_enabled}
            />{" "}
            I approve activating deposits for new online bookings
          </label>
        </AdminForm>
      </article>
      <h3>Latest 100 booking/payment records</h3>
      <p>
        Service totals and remaining balances are estimates. “Paid” is verified
        by Stripe; it is not estimated revenue. Cash or other in-salon payments
        are not recorded here.
      </p>
      {requests.data.map((r) => {
        const ap = r.appointments as unknown as {
          price_cents: number;
          status: string;
        } | null;
        return (
          <article className="card" key={r.id}>
            <h4>
              {r.status.replaceAll("_", " ")}
              {ap?.status === "cancelled" && r.paid_cents > r.refunded_cents
                ? " · cancelled booking: review deposit refund"
                : ""}
            </h4>
            <p>{displayTime(r.created_at, salon.timezone, true)}</p>
            <p>
              Original estimate {money(r.estimate_cents)} · Deposit{" "}
              {money(r.deposit_cents)} · Paid {money(r.paid_cents)} · Refunded{" "}
              {money(r.refunded_cents)} · Estimated remaining{" "}
              {money(
                remainingBalance(
                  ap?.price_cents ?? r.estimate_cents,
                  r.paid_cents,
                  r.refunded_cents,
                ),
              )}
            </p>
            {r.appointment_id && (
              <Link href={`/admin/appointments/${r.appointment_id}`}>
                Appointment →
              </Link>
            )}
            {r.last_error && <p>{r.last_error}</p>}
            {r.stripe_payment_intent && (
              <p>Stripe payment reference: {r.stripe_payment_intent}</p>
            )}
            <details>
              <summary>Policy accepted at booking</summary>
              <p>{r.policy_snapshot.cancellation_text}</p>
              <p>{r.policy_snapshot.refund_policy}</p>
            </details>
          </article>
        );
      })}
    </>
  );
}
