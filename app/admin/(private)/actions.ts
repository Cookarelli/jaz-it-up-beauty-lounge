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
  const parsed = serviceSchema.safeParse({ ...Object.fromEntries(form), active: form.has("active") });
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
