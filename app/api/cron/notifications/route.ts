import { env } from "@/lib/env";
import { secureEqual } from "@/lib/capabilities";
import { privilegedClient } from "@/lib/supabase";
import { processNotifications } from "@/lib/notifications";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (
    !env.CRON_SECRET ||
    !secureEqual(
      req.headers.get("authorization") || "",
      `Bearer ${env.CRON_SECRET}`,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { error } = await privilegedClient().rpc("expire_checkouts");
    if (error) throw error;
    return Response.json(await processNotifications(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Scheduled processing failed; retry and inspect the admin delivery log.",
      },
      { status: 503 },
    );
  }
}
