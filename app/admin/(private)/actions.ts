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
export async function saveService(
  _previous: import("@/lib/validation").ServiceFormState,
  form: FormData,
): Promise<import("@/lib/validation").ServiceFormState> {
  const db = await requireAdmin();
  const parsed = serviceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      message: "Check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const identity = z
    .object({
      id: z.uuid(),
      kind: z.enum(["service", "variant"]),
      revision: z.coerce.number().int().positive(),
    })
    .safeParse(Object.fromEntries(form));
  if (!identity.success) return { message: "Invalid entry. Reload the page." };
  const { error } = await db.rpc("edit_catalog_entry", {
    p_kind: identity.data.kind,
    p_id: identity.data.id,
    p_revision: identity.data.revision,
    p_values: parsed.data,
  });
  if (error)
    return {
      message: error.message.includes("changed or access")
        ? "Someone changed this entry. Reload before editing again."
        : "Could not save. Check values and your salon permissions.",
    };
  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath("/book");
  return { message: "Saved successfully.", saved: true };
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
