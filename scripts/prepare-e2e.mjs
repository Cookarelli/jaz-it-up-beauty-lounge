// No cloud project, real customer, provider key or deterministic password is used.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const status = JSON.parse(await readFile(".e2e/status.json", "utf8"));
const url = new URL(status.API_URL);
if (url.origin !== "http://127.0.0.1:54321")
  throw Error("E2E refuses a non-local Supabase URL");
const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
const secret = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
if (!publicKey || !secret) throw Error("Local Supabase credentials missing");
const password = randomBytes(32).toString("base64url") + "aA1!";
const db = createClient(url.origin, secret, {
  auth: { persistSession: false },
});
const { data: salon, error } = await db
  .from("salons")
  .select("id")
  .eq("name", "Jaz It Up Beauty Lounge")
  .single();
if (error)
  throw Error("Local migrations must be applied before E2E provisioning");
// A previously used database is not a fresh synthetic environment.
const count = await db
  .from("customers")
  .select("id", { count: "exact", head: true });
if (count.error || count.count !== 0)
  throw Error("E2E requires a fresh empty local customer database");
for (const [email, owner] of [
  ["owner@example.invalid", true],
  ["outsider@example.invalid", false],
]) {
  const result = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw Error("Synthetic Auth provisioning failed");
  if (owner) {
    const role = await db
      .from("staff_roles")
      .insert({
        salon_id: salon.id,
        user_id: result.data.user.id,
        role: "owner",
      });
    if (role.error) throw Error("Synthetic owner role could not be created");
  }
}
const environment = {
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: url.origin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SECRET_KEY: secret,
  BOOKING_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  PUBLIC_BOOKING_ENABLED: "true", // Only this disposable localhost server.
  SITE_INDEXING_ENABLED: "false",
  NOTIFICATIONS_ENABLED: "false",
  EMAIL_PROVIDER: "disabled",
  SMS_ENABLED: "false",
  PAYMENTS_ENABLED: "false",
  STRIPE_MODE: "test",
  E2E_PASSWORD: password,
};
await mkdir(".e2e", { recursive: true, mode: 0o700 });
await writeFile(".e2e/environment.json", JSON.stringify(environment), {
  mode: 0o600,
});
console.log(
  "Isolated local E2E credentials and synthetic accounts ready. Messaging and payments disabled.",
);
