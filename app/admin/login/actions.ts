"use server";
import { sessionClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function login(form: FormData) {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(8).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/login?error=1");
  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) redirect("/admin/login?error=1");
  const authorization = await db.rpc("is_salon_admin");
  if (authorization.error || authorization.data !== true) {
    await db.auth.signOut();
    redirect("/admin/login?error=1");
  }
  redirect("/admin");
}
export async function logout() {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect("/admin/login");
}
