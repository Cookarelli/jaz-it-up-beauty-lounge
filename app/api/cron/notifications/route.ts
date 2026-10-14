import { env } from "@/lib/env";
import { privilegedClient } from "@/lib/supabase";
import { WebhookAdapter } from "@/lib/notifications";
export async function GET(req: Request) {
  if (
    !env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.NOTIFICATION_WEBHOOK_URL || !env.NOTIFICATION_WEBHOOK_TOKEN)
    return Response.json(
      { error: "Notification adapter is not configured" },
      { status: 503 },
    );
  const db = privilegedClient();
  const { data, error } = await db.rpc("claim_notifications");
  if (error)
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  let sent = 0;
  for (const job of data || []) {
    try {
      const current = await db
        .from("notification_jobs")
        .select("generation,sent_at,appointments!inner(status)")
        .eq("id", job.id)
        .single();
      if (
        current.error ||
        !current.data ||
        current.data.generation !== job.generation ||
        current.data.sent_at ||
        (current.data.appointments as unknown as { status: string }).status !==
          "confirmed"
      )
        continue;
      await db
        .from("notification_events")
        .insert({ job_id: job.id, event_type: "attempted" });
      await new WebhookAdapter().send({
        ...job,
        id: `${job.id}:${job.generation}`,
      });
      const { error } = await db
        .from("notification_jobs")
        .update({ sent_at: new Date().toISOString(), locked_until: null })
        .eq("id", job.id)
        .eq("generation", job.generation);
      if (error) throw error;
      await db
        .from("notification_events")
        .insert({ job_id: job.id, event_type: "delivered" });
      sent++;
    } catch {
      await db
        .from("notification_events")
        .insert({ job_id: job.id, event_type: "failed" });
      await db
        .from("notification_jobs")
        .update({ locked_until: new Date(Date.now() + 300000).toISOString() })
        .eq("id", job.id)
        .eq("generation", job.generation);
    }
  }
  return Response.json({ sent });
}
