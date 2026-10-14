"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { localDate } from "@/lib/admin-time";
import { formatPrice, type BookingOption } from "@/lib/service-types";
export function BookingForm({
  services,
  initialSelection,
  allowSms = false,
  allowEmailReminders = false,
}: {
  services: BookingOption[];
  initialSelection?: string;
  allowSms?: boolean;
  allowEmailReminders?: boolean;
}) {
  const router = useRouter();
  const lookup = useRef<AbortController | null>(null);
  useEffect(() => () => lookup.current?.abort(), []);
  const [service, setService] = useState(
    services.some((s) => s.id === initialSelection)
      ? initialSelection!
      : services[0]?.id || "",
  );
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<
    { starts_at: string; stylist_id: string }[]
  >([]);
  const [slot, setSlot] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [checkout, setCheckout] = useState<{
    url: string;
    id: string;
    deposit: number;
    estimate: number;
    policy: { cancellation_text: string; refund_policy: string };
  } | null>(null);
  const attempt = useRef<{
    fingerprint: string;
    id: string;
    token: string;
  } | null>(null);
  const option = services.find((s) => s.id === service);
  function clearAvailability() {
    lookup.current?.abort();
    lookup.current = null;
    setBusy(false);
    setSlots([]);
    setSlot("");
    setMessage("");
  }
  async function find() {
    if (!option || !date) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setBusy(true);
    setMessage("Looking for available times…");
    setSlot("");
    setSlots([]);
    try {
      const r = await fetch(
        `/api/availability?service=${option.service_id}&date=${date}${option.variant_id ? `&variant=${option.variant_id}` : ""}`,
        { signal: controller.signal },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (controller.signal.aborted) return;
      setSlots(d.slots);
      setMessage(
        d.slots.length
          ? "Choose an available time."
          : "No openings on this date. Try another day.",
      );
    } catch {
      if (controller.signal.aborted) return;
      setMessage("Availability is temporarily unavailable. Please try again.");
    } finally {
      if (lookup.current === controller) setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const selected = slot === "" ? null : slots[Number(slot)];
      if (!selected || !option) throw Error("Choose an available time first.");
      const booking = {
        service_id: option.service_id,
        variant_id: option.variant_id ?? null,
        ...selected,
        name: f.get("name"),
        email: f.get("email"),
        phone: f.get("phone"),
        website: f.get("website"),
        email_reminders_consent: f.get("email_reminders_consent") === "on",
        sms_consent: f.get("sms_consent") === "on",
      };
      const fingerprint = JSON.stringify(booking);
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = {
          fingerprint,
          id: crypto.randomUUID(),
          token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join(""),
        };
      const { id, token } = attempt.current!;
      sessionStorage.setItem(`booking:${id}`, token);
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...booking,
          request_id: id,
          access_token: token,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.status === "pending") {
        setCheckout({
          url: d.checkout_url,
          id: d.request_id,
          deposit: d.deposit_cents,
          estimate: d.estimate_cents,
          policy: d.policy,
        });
        setMessage(
          "Your time is held temporarily. Review the deposit and policies below. Your booking is not confirmed yet.",
        );
      } else {
        setDone(true);
        setMessage(
          `Your appointment is confirmed. Reference: ${d.reference}. Opening your visit details…`,
        );
        router.push(`/booking-status?id=${d.request_id}`);
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not book. Please retry.",
      );
    } finally {
      setSubmitting(false);
      setBusy(false);
    }
  }
  return (
    <>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {checkout && (
        <article className="card">
          <h2>Review your appointment deposit</h2>
          <p>
            Estimated service total: ${(checkout.estimate / 100).toFixed(2)}.
            Deposit due now: ${(checkout.deposit / 100).toFixed(2)}.
          </p>
          <p>{checkout.policy.cancellation_text}</p>
          <p>{checkout.policy.refund_policy}</p>
          <p>
            Your appointment becomes confirmed only after payment is verified.
            Closing Checkout does not confirm it; the temporary hold expires
            automatically.
          </p>
          <a className="button" href={checkout.url}>
            Agree to policies & continue to secure payment
          </a>
          <p>
            <a href={`/booking-status?id=${checkout.id}`}>
              Check status or end this checkout
            </a>
          </p>
        </article>
      )}
      {!done && !checkout && (
        <form onSubmit={submit} className="booking-form">
          <h2>1. Choose your visit</h2>
          <p className="booking-help">
            All times are Central Time (America/Chicago), including daylight
            saving time. Only available times that fit the complete service and
            its buffers are shown.
          </p>
          <label>
            Service
            <select
              value={service}
              disabled={submitting}
              onChange={(e) => {
                setService(e.target.value);
                clearAvailability();
              }}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatPrice(s)}
                </option>
              ))}
            </select>
          </label>
          {option && (
            <aside className="booking-summary" aria-label="Selected service">
              <strong>{option.name}</strong>
              <span>
                {option.duration_minutes} minutes · {formatPrice(option)}
              </span>
              {option.length_qualification &&
                option.length_qualification !== "any" && (
                  <span>{option.length_qualification}</span>
                )}
              {option.includes_cut_style && (
                <span>Haircut and style included.</span>
              )}
              {!!(option.preparation_minutes + option.cleanup_minutes) && (
                <small>
                  We also reserve{" "}
                  {option.preparation_minutes + option.cleanup_minutes} minutes
                  for preparation and cleanup.
                </small>
              )}
              <small>The salon confirms your final service total.</small>
            </aside>
          )}
          <label>
            Preferred date
            <input
              type="date"
              required
              value={date}
              disabled={submitting}
              min={localDate()}
              onChange={(e) => {
                setDate(e.target.value);
                clearAvailability();
              }}
            />
          </label>
          <button type="button" disabled={busy || !date} onClick={find}>
            Find available times
          </button>
          <label>
            Time (Central Time)
            <select
              required
              value={slot}
              disabled={!slots.length || busy}
              onChange={(e) => setSlot(e.target.value)}
            >
              <option value="">Choose a time</option>
              {slots.map((s, i) => (
                <option value={i} key={s.starts_at + s.stylist_id}>
                  {new Date(s.starts_at).toLocaleTimeString("en-US", {
                    timeZone: "America/Chicago",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </option>
              ))}
            </select>
          </label>
          <h2>2. Your contact details</h2>
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              minLength={7}
              maxLength={30}
            />
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <p className="muted">
            Save the confirmation page after booking. Email and text delivery
            are only available when enabled by the salon; do not rely on a
            message to confirm your visit.{" "}
            <a href="/privacy">Privacy and message preferences</a>.
          </p>
          {allowEmailReminders && (
            <label>
              <span>
                <input type="checkbox" name="email_reminders_consent" /> I would
                also like email reminders. Optional; unsubscribe at any time.
              </span>
            </label>
          )}
          {allowSms && (
            <label>
              <input type="checkbox" name="sms_consent" /> I agree to receive
              appointment texts from Jaz It Up Beauty Lounge at this number (use
              +1 and the number). Consent is optional and not required to book.
              Message frequency varies; message/data rates may apply. Reply STOP
              to opt out or contact the salon for help.
            </label>
          )}
          <h2>3. Reserve your time</h2>
          {slot !== "" && slots[Number(slot)] && (
            <p className="booking-summary">
              {option?.name} ·{" "}
              {new Date(slots[Number(slot)].starts_at).toLocaleString("en-US", {
                timeZone: "America/Chicago",
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              })}
            </p>
          )}
          <p className="booking-help">
            Your time is reserved only when you see a confirmed booking. If
            another customer takes this time first, choose a new opening.
          </p>
          <button disabled={busy || slot === ""} type="submit">
            {busy ? "Please wait…" : "Reserve appointment"}
          </button>
        </form>
      )}
    </>
  );
}
