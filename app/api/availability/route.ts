import { privilegedClient } from "@/lib/supabase";
import { z } from "zod";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = z
    .object({
      service: z.uuid(),
      date: z.iso.date(),
      variant: z.uuid().optional(),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return Response.json(
      { error: "Choose a valid service and date." },
      { status: 400 },
    );
  try {
    const { data, error } = await privilegedClient().rpc("available_slots", {
      p_service: parsed.data.service,
      p_date: parsed.data.date,
      p_variant: parsed.data.variant ?? null,
    });
    if (error) throw error;
    return Response.json(
      { slots: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Availability is temporarily unavailable." },
      { status: 503 },
    );
  }
}
