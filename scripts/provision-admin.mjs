// Run locally with a server secret. This grants a role to an existing, verified Auth user.
// It never creates accounts, passwords, invitation links, or email messages.
import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  ADMIN_AUTH_USER_ID,
  ADMIN_SALON_ID,
} = process.env;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if (
  !NEXT_PUBLIC_SUPABASE_URL ||
  !SUPABASE_SECRET_KEY ||
  !uuid.test(ADMIN_AUTH_USER_ID || "") ||
  !uuid.test(ADMIN_SALON_ID || "")
)
  throw Error(
    "Set the project URL, server-only key, ADMIN_AUTH_USER_ID and ADMIN_SALON_ID in an ignored local environment file.",
  );
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.auth.admin.getUserById(ADMIN_AUTH_USER_ID);
if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
  throw Error("An existing, verified, non-anonymous Auth user is required.");
const salon = await db
  .from("salons")
  .select("id")
  .eq("id", ADMIN_SALON_ID)
  .single();
if (salon.error) throw Error("The selected salon does not exist.");
const result = await db
  .from("staff_roles")
  .upsert(
    { salon_id: ADMIN_SALON_ID, user_id: ADMIN_AUTH_USER_ID, role: "owner" },
    { onConflict: "salon_id,user_id" },
  );
if (result.error)
  throw Error(
    "Could not grant owner access. Check the project and operator permissions.",
  );
console.log(
  "Owner access granted to the specified verified user for the specified salon. Sign in at /admin/login.",
);
