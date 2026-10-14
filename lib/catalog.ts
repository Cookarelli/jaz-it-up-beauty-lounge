import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configured, env } from "./env";
import type { Service } from "./service-types";
import menu from "@/data/service-menu.json";
export type { Service } from "./service-types";
const fields =
  "id,salon_id,slug,category,name,description,pricing_type,price_cents,price_max_cents,duration_minutes,duration_min_minutes,duration_max_minutes,price_approved,duration_approved,status,active,length_qualification,display_order,preparation_minutes,cleanup_minutes,includes_cut_style,revision";
export async function catalog() {
  if (!configured) {
    const services = menu.services.map((s) => {
      const { admin_notes: notes, ...safe } = s;
      void notes;
      return {
        ...safe,
        id: s.slug,
        salon_id: "",
        active: true,
        revision: 1,
        variants: menu.variants
          .filter((v) => v.parent_slug === s.slug)
          .map((v) => {
            const { admin_notes: notes, parent_slug: parent, ...safe } = v;
            void notes;
            void parent;
            return {
              ...safe,
              id: `${s.slug}/${v.slug}`,
              salon_id: "",
              active: true,
              revision: 1,
            };
          }),
      };
    }) as Service[];
    return { services, live: false };
  }
  // Always query as anon: a logged-in non-staff user must not gain access to admin notes.
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const [s, v] = await Promise.all([
    db
      .from("services")
      .select(fields)
      .eq("status", "published")
      .eq("active", true)
      .order("display_order"),
    db
      .from("service_variants")
      .select(fields + ",service_id")
      .eq("status", "published")
      .eq("active", true)
      .order("display_order"),
  ]);
  if (s.error || v.error)
    throw Error("The service catalog is temporarily unavailable.");
  const services = (s.data as unknown as Service[]).map((s) => ({
    ...s,
    variants: (v.data as unknown as Service[]).filter(
      (v) => v.service_id === s.id,
    ),
  }));
  return { services, live: true };
}
