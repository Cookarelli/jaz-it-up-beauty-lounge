"use server";
import { adminClient } from "@/lib/supabase";
import { serviceSchema } from "@/lib/validation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
async function requireAdmin() {
  const db = await adminClient();
  if (!db) throw Error("Unauthorized");
  return db;
}
export async function saveService(form: FormData) {
  const db = await requireAdmin();
  const values = serviceSchema.parse(Object.fromEntries(form));
  const id = form.get("id");
  const result = id
    ? await db
        .from("services")
        .update({ ...values, active: form.get("active") === "on" })
        .eq("id", z.uuid().parse(id))
    : await db.from("services").insert(values);
  if (result.error) throw Error("Could not save service");
  revalidatePath("/admin/services");
  revalidatePath("/services");
}
export async function updateAppointment(form: FormData) {
  const db = await requireAdmin();
  const id = z.uuid().parse(form.get("id"));
  const status = z
    .enum(["confirmed", "cancelled", "completed"])
    .parse(form.get("status"));
  const { error } = await db
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw Error("Could not update appointment");
  revalidatePath("/admin");
}
export async function addAvailability(form: FormData) {
  const db = await requireAdmin();
  const stylist = z.uuid().parse(form.get("stylist_id"));
  const start = z.iso.datetime({ offset: true }).parse(form.get("starts_at"));
  const end = z.iso.datetime({ offset: true }).parse(form.get("ends_at"));
  if (new Date(end) <= new Date(start)) throw Error("End must follow start");
  const { error } = await db
    .from("availability")
    .insert({ stylist_id: stylist, starts_at: start, ends_at: end });
  if (error) throw Error("Could not publish availability");
  revalidatePath("/admin/availability");
}
export async function removeAvailability(form: FormData) {
  const db = await requireAdmin();
  const { error } = await db
    .from("availability")
    .delete()
    .eq("id", z.uuid().parse(form.get("id")));
  if (error) throw Error("Could not remove availability");
  revalidatePath("/admin/availability");
}
