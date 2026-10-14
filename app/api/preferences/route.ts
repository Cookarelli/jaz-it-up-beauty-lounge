import { integrations } from "@/lib/integrations";
import { verifyPreference } from "@/lib/capabilities";
import { privilegedClient } from "@/lib/supabase";
import { z } from "zod";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  try {
    const { token, channel } = z
      .object({ token: z.string().max(300), channel: z.enum(["email", "sms"]) })
      .parse(await req.json());
    const id = integrations.NOTIFICATION_LINK_SECRET
      ? verifyPreference(token, integrations.NOTIFICATION_LINK_SECRET)
      : null;
    if (!id) throw Error();
    const db = privilegedClient();
    const a = await db
      .from("appointments")
      .select("email,phone,services!inner(salon_id)")
      .eq("id", id)
      .single();
    if (a.error) throw a.error;
    const { salon_id } = a.data.services as unknown as { salon_id: string };
    const r = await db.rpc("suppress_contact", {
      p_salon: salon_id,
      p_channel: channel,
      p_target: channel === "email" ? a.data.email : a.data.phone,
      p_reason: "customer_opt_out",
    });
    if (r.error) throw r.error;
    return Response.json({
      message:
        "Your preference is saved. This does not cancel your appointment. Contact the salon for appointment changes.",
    });
  } catch {
    return Response.json(
      {
        error:
          "This link is invalid or expired. Contact the salon to update your preferences.",
      },
      { status: 400 },
    );
  }
}
