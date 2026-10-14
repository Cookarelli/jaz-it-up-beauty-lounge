import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, configured } from "./env";
export async function sessionClient() {
  if (!configured) throw new Error("Supabase is not configured");
  const jar = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server components cannot set cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
export function privilegedClient() {
  if (!configured || !env.SUPABASE_SECRET_KEY)
    throw new Error("Booking is not configured");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function adminClient() {
  if (!configured) return null;
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.rpc("is_salon_admin");
  return data === true ? db : null;
}
