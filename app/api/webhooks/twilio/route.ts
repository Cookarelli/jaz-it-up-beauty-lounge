import { logServerFailure } from "@/lib/http-safety";
import { integrations } from "@/lib/integrations";
import { env } from "@/lib/env";
import { verifyTwilio } from "@/lib/communications/adapters";
import { privilegedClient } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!integrations.TWILIO_AUTH_TOKEN)
    return new Response(null, { status: 503 });
  const raw = await req.text();
  if (raw.length > 100000) return new Response(null, { status: 413 });
  const p = Object.fromEntries(new URLSearchParams(raw));
  if (
    !verifyTwilio(
      `${new URL(env.NEXT_PUBLIC_SITE_URL).origin}/api/webhooks/twilio`,
      p,
      req.headers.get("x-twilio-signature") || "",
      integrations.TWILIO_AUTH_TOKEN,
    ) ||
    p.AccountSid !== integrations.TWILIO_ACCOUNT_SID
  )
    return new Response(null, { status: 403 });
  try {
    const db = privilegedClient();
    if (
      p.OptOutType === "STOP" ||
      /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(
        (p.Body || "").trim(),
      )
    ) {
      const salons = await db.from("communication_settings").select("salon_id");
      if (salons.error) throw salons.error;
      for (const s of salons.data) {
        const result = await db.rpc("suppress_contact", {
          p_salon: s.salon_id,
          p_channel: "sms",
          p_target: p.From,
          p_reason: "provider_opt_out",
        });
        if (result.error) throw result.error;
      }
    } else if (
      ["delivered", "undelivered", "failed"].includes(p.MessageStatus)
    ) {
      const result = await db.rpc("record_delivery_event", {
        p_provider: "twilio",
        p_event: `${p.MessageSid}:${p.MessageStatus}`,
        p_message: p.MessageSid,
        p_status: p.MessageStatus === "delivered" ? "delivered" : "failed",
      });
      if (result.error || !result.data) throw Error();
    }
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    logServerFailure("twilio_webhook_processing_failure");
    return new Response(null, { status: 503 });
  }
}
