"use client";
import { useState } from "react";
import type { Service } from "@/lib/catalog";
export function BookingForm({ services }: { services: Service[] }) {
  const [service, setService] = useState(services[0]?.id || "");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<
    { starts_at: string; stylist_id: string }[]
  >([]);
  const [slot, setSlot] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function find() {
    setBusy(true);
    setSlot("");
    setSlots([]);
    try {
      const r = await fetch(
        `/api/availability?service=${service}&date=${date}`,
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setSlots(d.slots);
      setMessage(
        d.slots.length
          ? "Choose an available time."
          : "No openings on this date. Try another day.",
      );
    } catch {
      setMessage("Availability is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const selected = slots[Number(slot)];
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: service,
          ...selected,
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          website: f.get("website"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDone(true);
      setMessage(
        `Your appointment is reserved. Reference: ${d.reference}. Save this reference; confirmation delivery may take a few minutes.`,
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not book. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!done && (
        <form onSubmit={submit}>
          <label>
            Service
            <select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setSlots([]);
                setSlot("");
              }}
              required
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · ${(s.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred date
            <input
              type="date"
              required
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setDate(e.target.value);
                setSlots([]);
                setSlot("");
              }}
            />
          </label>
          <button type="button" disabled={busy || !date} onClick={find}>
            Find available times
          </button>
          <label>
            Time (salon local time)
            <select
              required
              value={slot}
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
          <label>
            Your name
            <input name="name" autoComplete="name" required maxLength={100} />
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
            By booking, you agree to receive appointment confirmations and
            reminders. See our <a href="/privacy">privacy notice</a>.
          </p>
          <button disabled={busy || slot === ""} type="submit">
            {busy ? "Please wait…" : "Reserve appointment"}
          </button>
        </form>
      )}
    </>
  );
}
