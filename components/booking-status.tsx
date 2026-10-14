"use client";
import { useEffect, useState } from "react";
import { remainingBalance } from "@/lib/payments/core";
type Status = {
  status: string;
  appointment: {
    starts_at: string;
    ends_at: string;
    service: string;
    includes_cut_style: boolean;
    timezone: string;
  } | null;
  reference: string | null;
  estimate_cents: number;
  deposit_cents: number;
  paid_cents: number;
  refunded_cents: number;
  expires_at: string;
};
export function BookingStatus({ id }: { id: string }) {
  const [data, setData] = useState<Status | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let pending = true;
    let loading = false;
    const controller = new AbortController();
    async function load() {
      if (!active || !pending || loading) return;
      loading = true;
      try {
        const token = sessionStorage.getItem(`booking:${id}`);
        if (!token)
          throw Error(
            "Open this page in the browser where you started booking, or contact the salon.",
          );
        const r = await fetch("/api/booking-status", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, token }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          pending = d.status === "pending";
          setData(d);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Status unavailable.");
      } finally {
        loading = false;
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [id]);
  async function cancel() {
    if (!window.confirm("End this unpaid checkout and release the time?"))
      return;
    try {
      const r = await fetch("/api/booking-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          token: sessionStorage.getItem(`booking:${id}`),
        }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error);
      else setData((x) => (x ? { ...x, status: "expired" } : x));
    } catch {
      setError(
        "Could not reach the salon. The temporary hold will still expire automatically.",
      );
    }
  }

  const labels: Record<string, string> = {
    cancelled:
      "Your appointment has been cancelled. Contact the salon about any deposit refund",
    completed: "Your appointment is complete",
    no_show:
      "This appointment was marked as a no-show; contact the salon if this is incorrect",
    pending: "Awaiting verified payment — not confirmed",
    confirmed: "Your appointment is confirmed",
    expired: "This checkout expired; the appointment is not reserved",
    failed: "Payment did not complete; the appointment is not reserved",
    refund_review:
      "Payment received, but the appointment could not be confirmed. Please contact the salon for a refund review",
    refunded: "Your deposit was refunded; no appointment was reserved",
  };
  return (
    <div aria-live="polite">
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          <h2>{labels[data.status] || "Check with the salon"}</h2>
          {data.appointment && (
            <article className="booking-summary" aria-label="Your visit">
              <strong>{data.appointment.service}</strong>
              <time dateTime={data.appointment.starts_at}>
                {new Date(data.appointment.starts_at).toLocaleString("en-US", {
                  timeZone: data.appointment.timezone,
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </time>
              <span>
                {Math.round(
                  (Date.parse(data.appointment.ends_at) -
                    Date.parse(data.appointment.starts_at)) /
                    60000,
                )}{" "}
                minutes
              </span>
              {data.appointment.includes_cut_style && (
                <span>Haircut and style included.</span>
              )}
            </article>
          )}
          {data.reference && (
            <p className="booking-reference">
              Booking reference: {data.reference}
            </p>
          )}
          {data.status === "confirmed" && (
            <p>
              Save these details. Contact the salon to change or cancel your
              visit. Email and text delivery depend on the salon’s settings.
            </p>
          )}
          <p>
            Estimated service cost: ${(data.estimate_cents / 100).toFixed(2)} ·
            Required deposit: ${(data.deposit_cents / 100).toFixed(2)} · Paid: $
            {(data.paid_cents / 100).toFixed(2)} · Refunded: $
            {(data.refunded_cents / 100).toFixed(2)}
          </p>
          {data.status === "confirmed" && (
            <p>
              Estimated remaining balance: $
              {(
                remainingBalance(
                  data.estimate_cents,
                  data.paid_cents,
                  data.refunded_cents,
                ) / 100
              ).toFixed(2)}
              . The salon confirms the final service total.
            </p>
          )}
          {data.status === "pending" && (
            <>
              <p>
                Payment verification may take a moment. Returning from Checkout
                alone does not confirm a booking. The temporary hold ends at{" "}
                {new Date(data.expires_at).toLocaleTimeString("en-US", {
                  timeZone: "America/Chicago",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
                .
              </p>
              <button onClick={cancel}>End unpaid checkout</button>
            </>
          )}
        </>
      ) : (
        <p>Checking booking status…</p>
      )}
      <p>
        <a href="/contact">Contact the salon</a> ·{" "}
        <a href="/book">Book another appointment</a>
      </p>
    </div>
  );
}
