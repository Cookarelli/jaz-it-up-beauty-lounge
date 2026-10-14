import "server-only";
import { z } from "zod";
import { privilegedClient } from "./supabase";
import { hashToken } from "./capabilities";
export async function accessBooking(req: Request) {
  const input = z
    .object({ id: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) })
    .safeParse(await req.json());
  if (!input.success) throw Error("Invalid capability");
  const db = privilegedClient();
  const { data, error } = await db
    .from("booking_requests")
    .select("*")
    .eq("id", input.data.id)
    .eq("token_hash", hashToken(input.data.token))
    .single();
  if (error || !data) throw Error("Invalid capability");
  return { db, data };
}
