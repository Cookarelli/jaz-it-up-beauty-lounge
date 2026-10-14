import { Webhook } from "svix";
import { integrations } from "@/lib/integrations";
import { privilegedClient } from "@/lib/supabase";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!integrations.RESEND_WEBHOOK_SECRET)
    return new Response(null, { status: 503 });
  const raw = await req.text();
  if (raw.length > 1000000) return new Response(null, { status: 413 });
  let payload;
  try {
    payload = new Webhook(integrations.RESEND_WEBHOOK_SECRET).verify(
      raw,
      Object.fromEntries(req.headers),
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  const parsed = z
    .object({ type: z.string(), data: z.object({ email_id: z.string() }) })
    .safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });
  const statuses: Record<string, string> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.failed": "failed",
  };
  const status = statuses[parsed.data.type];
  if (!status) return Response.json({ received: true });
  try {
    const r = await privilegedClient().rpc("record_delivery_event", {
      p_provider: "resend",
      p_event: req.headers.get("svix-id"),
      p_message: parsed.data.data.email_id,
      p_status: status,
    });
    if (r.error || !r.data) throw Error();
    return Response.json({ received: true });
  } catch {
    return new Response(null, { status: 503 });
  }
}
