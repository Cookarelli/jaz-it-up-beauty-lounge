"use client";
import { useState } from "react";
export default function Preferences() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function stop(channel: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: window.location.hash.slice(1), channel }),
      });
      const d = await r.json();
      setMessage(d.message || d.error);
    } catch {
      setMessage("Please contact the salon to update your preferences.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="narrow">
      <h1>Appointment messages</h1>
      <p>
        Choose which messages to stop. Your appointment stays in place. Contact
        the salon for changes or to resume messages.
      </p>
      <p role="status">{message}</p>
      <button disabled={busy} onClick={() => stop("email")}>
        Stop appointment emails
      </button>{" "}
      <button disabled={busy} onClick={() => stop("sms")}>
        Stop appointment texts
      </button>
    </section>
  );
}
