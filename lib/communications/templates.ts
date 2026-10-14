export type MessageKind =
  "confirmation" | "reschedule" | "cancellation" | "reminder";
export type MessagePayload = {
  name: string;
  email: string | null;
  phone: string;
  starts_at: string;
  ends_at: string;
  reference: string;
  service: string;
  salon: string;
  timezone: string;
  salon_phone: string;
  salon_email: string;
  address: string;
};
export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
const headings: Record<MessageKind, string> = {
  confirmation: "Your appointment is confirmed",
  reschedule: "Your appointment has been rescheduled",
  cancellation: "Your appointment has been cancelled",
  reminder: "A little reminder about your appointment",
};
export function renderMessage(
  kind: MessageKind,
  p: MessagePayload,
  preferencesUrl: string,
) {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: p.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(p.starts_at));
  const heading = headings[kind];
  const contact = [p.salon_phone, p.salon_email, p.address]
    .filter(Boolean)
    .join(" · ");
  const lines = [
    `Hi ${p.name},`,
    heading + ".",
    p.salon,
    `${p.service} — ${when}`,
    contact || "For changes, use the Contact page on our website.",
    `Booking reference: ${p.reference}`,
    kind === "cancellation"
      ? "If you paid a deposit, cancellation does not automatically issue a refund. The salon will review it under your booking policy."
      : "We look forward to seeing you. Contact the salon if you need to make a change.",
    `Manage appointment messages: ${preferencesUrl}`,
  ];
  return {
    subject: `${p.salon}: ${heading.toLowerCase()}`,
    text: lines.join("\n\n"),
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f8f4eb;color:#273331;font-family:Arial,sans-serif"><main style="max-width:580px;margin:24px auto;padding:32px;background:#fffdfa;border-top:5px solid #287c7a"><p style="color:#287c7a;letter-spacing:2px">${escapeHtml(p.salon)}</p><h1 style="font-size:25px">${escapeHtml(heading)}</h1>${lines
      .slice(0, -1)
      .map((l) => `<p style="line-height:1.6">${escapeHtml(l)}</p>`)
      .join(
        "",
      )}<p><a href="${escapeHtml(preferencesUrl)}">Manage appointment messages</a></p><p style="color:#776748">A little refresh. A whole new feeling.</p></main></body></html>`,
    sms: `${p.salon}: ${heading}. ${p.service}, ${when}. ${p.salon_phone ? `Questions: ${p.salon_phone}.` : "Contact the salon for changes."} Reply STOP to opt out.`,
  };
}
