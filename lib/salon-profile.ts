import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, configured } from "./env";
export async function publicProfile() {
  if (!configured) return null;
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const r = await db
    .from("salon_profiles")
    .select(
      "salon_id,phone,email,address,instagram_url,facebook_url,hero_title,hero_text,about_text",
    )
    .limit(1)
    .maybeSingle();
  if (r.error) throw Error("Salon information is temporarily unavailable.");
  if (!r.data) return null;
  const hours = await db
    .from("business_hours")
    .select("weekday,opens_at,closes_at")
    .eq("salon_id", r.data.salon_id)
    .order("weekday");
  if (hours.error) throw Error("Salon hours are temporarily unavailable.");
  return { ...r.data, hours: hours.data };
}
