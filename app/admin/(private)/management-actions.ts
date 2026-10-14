"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminContext } from "@/lib/admin";
import { localToISO } from "@/lib/admin-time";
import {
  appointmentSchema,
  customerSchema,
  hoursSchema,
  closureSchema,
  profileSchema,
  policySchema,
  type AdminState,
} from "@/lib/admin-validation";
const identity = z.object({
  id: z.uuid(),
  revision: z.coerce.number().int().positive(),
});
function fail(error: unknown): AdminState {
  if (error instanceof z.ZodError)
    return {
      message: "Check the form values.",
      errors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  const message = error instanceof Error ? error.message : "Could not save.";
  const safe = [
    "daylight saving",
    "valid local",
    "valid time",
    "Record changed",
    "conflict",
    "has not started",
    "Closed appointments",
    "Choose a service variant",
    "booking hold",
    "End must follow",
  ];
  return {
    message: safe.some((x) => message.toLowerCase().includes(x.toLowerCase()))
      ? message
      : "Could not save. Check your values, refresh the record, and try again.",
  };
}
function check(error: { message: string } | null) {
  if (error) throw Error(error.message);
}
function refresh() {
  for (const path of [
    "/admin",
    "/admin/calendar",
    "/admin/appointments",
    "/admin/customers",
    "/admin/availability",
    "/admin/settings",
    "/admin/reports",
    "/admin/history",
    "/",
    "/contact",
    "/book",
  ])
    revalidatePath(path, "page");
}
export async function saveCustomer(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = customerSchema.parse(Object.fromEntries(form));
    let id: string;
    if (form.get("id")) {
      const key = identity.parse(Object.fromEntries(form));
      const r = await db
        .from("customers")
        .update(values)
        .eq("id", key.id)
        .eq("salon_id", salon.id)
        .eq("revision", key.revision)
        .select("id")
        .maybeSingle();
      check(r.error);
      if (!r.data)
        throw Error("Record changed or access denied. Reload before editing.");
      id = r.data.id;
    } else {
      const r = await db
        .from("customers")
        .insert({ ...values, salon_id: salon.id })
        .select("id")
        .single();
      check(r.error);
      id = r.data!.id;
    }
    refresh();
    revalidatePath(`/admin/customers/${id}`);
    return {
      message: "Customer saved.",
      saved: true,
      href: `/admin/customers/${id}`,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function createAppointment(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = appointmentSchema.parse(Object.fromEntries(form));
    const refs = z
      .object({
        customer_id: z.uuid(),
        stylist_id: z.uuid(),
        service_id: z.uuid(),
        variant_id: z.union([z.uuid(), z.literal("")]),
        source: z.enum(["phone", "walk_in"]),
        request_id: z.uuid(),
      })
      .parse(Object.fromEntries(form));
    const r = await db.rpc("admin_create_appointment", {
      p_salon: salon.id,
      p_customer: refs.customer_id,
      p_service: refs.service_id,
      p_variant: refs.variant_id || null,
      p_stylist: refs.stylist_id,
      p_start: localToISO(values.starts_at, salon.timezone),
      p_duration: values.duration_minutes,
      p_price: values.price_cents,
      p_source: refs.source,
      p_notes: values.notes,
      p_request: refs.request_id,
    });
    check(r.error);
    refresh();
    return {
      message:
        "Appointment added. Email notifications are queued when an email is available.",
      saved: true,
      href: `/admin/appointments/${r.data}`,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function editAppointment(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const key = identity.parse(Object.fromEntries(form));
    const values = appointmentSchema.parse(Object.fromEntries(form));
    const r = await db.rpc("admin_update_appointment", {
      p_id: key.id,
      p_revision: key.revision,
      p_start: localToISO(values.starts_at, salon.timezone),
      p_duration: values.duration_minutes,
      p_price: values.price_cents,
      p_status: values.status,
      p_notes: values.notes,
    });
    check(r.error);
    refresh();
    revalidatePath(`/admin/appointments/${key.id}`);
    return { message: "Appointment saved.", saved: true };
  } catch (e) {
    return fail(e);
  }
}
export async function saveHours(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = hoursSchema.parse(Object.fromEntries(form));
    const kind = z.enum(["business", "working"]).parse(form.get("kind"));
    const table = kind === "business" ? "business_hours" : "working_hours";
    const extra =
      kind === "working"
        ? { stylist_id: z.uuid().parse(form.get("stylist_id")) }
        : {};
    const { error } = await db.from(table).upsert(
      { ...values, ...extra, salon_id: salon.id },
      {
        onConflict:
          kind === "working" ? "stylist_id,weekday" : "salon_id,weekday",
      },
    );
    check(error);
    refresh();
    return {
      message: "Recurring hours saved. Existing appointments keep their times.",
      saved: true,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function addBlock(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = z
      .object({
        stylist_id: z.uuid(),
        starts_at: z.string(),
        ends_at: z.string(),
        note: z.string().trim().max(500),
      })
      .parse(Object.fromEntries(form));
    const starts_at = localToISO(values.starts_at, salon.timezone),
      ends_at = localToISO(values.ends_at, salon.timezone);
    if (ends_at <= starts_at) throw Error("End must follow start.");
    const r = await db
      .from("time_blocks")
      .insert({ ...values, starts_at, ends_at, salon_id: salon.id });
    check(r.error);
    refresh();
    return { message: "Time off blocked.", saved: true };
  } catch (e) {
    return fail(e);
  }
}
export async function addClosure(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const v = closureSchema.parse(Object.fromEntries(form));
    const stylist = z
      .union([z.uuid(), z.literal("")])
      .parse(form.get("stylist_id"));
    const r = await db.from("schedule_exceptions").insert({
      ...v,
      salon_id: salon.id,
      stylist_id: stylist || null,
      opens_at: v.closed ? null : v.opens_at,
      closes_at: v.closed ? null : v.closes_at,
    });
    check(r.error);
    refresh();
    return { message: "Special hours saved.", saved: true };
  } catch (e) {
    return fail(e);
  }
}
export async function removeScheduleEntry(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const table = z
      .enum([
        "working_hours",
        "business_hours",
        "time_blocks",
        "schedule_exceptions",
        "availability",
      ])
      .parse(form.get("table"));
    const id = z.uuid().parse(form.get("id"));
    let query = db.from(table).delete().eq("id", id);
    if (table !== "availability") query = query.eq("salon_id", salon.id);
    const r = await query.select("id");
    check(r.error);
    if (r.data?.length !== 1)
      throw Error("Record changed. Reload before editing.");
    refresh();
    return {
      message: "Schedule entry removed. Existing appointments are preserved.",
      saved: true,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function saveProfile(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = profileSchema.parse(Object.fromEntries(form));
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const r = await db
      .from("salon_profiles")
      .update(values)
      .eq("salon_id", salon.id)
      .eq("revision", revision)
      .select("salon_id")
      .maybeSingle();
    check(r.error);
    if (!r.data) throw Error("Record changed. Reload before editing.");
    refresh();
    return { message: "Salon website updated.", saved: true };
  } catch (e) {
    return fail(e);
  }
}
export async function savePolicy(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const values = policySchema.parse(Object.fromEntries(form));
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const r = await db
      .from("booking_policies")
      .update(values)
      .eq("salon_id", salon.id)
      .eq("revision", revision)
      .select("salon_id")
      .maybeSingle();
    check(r.error);
    if (!r.data) throw Error("Record changed. Reload before editing.");
    refresh();
    return {
      message:
        "Booking policies saved. Deposit activation is managed under Payments.",
      saved: true,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function createCatalogEntry(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  const { db, salon } = await adminContext();
  try {
    const v = z
      .object({
        name: z.string().trim().min(2).max(100),
        category: z.string().trim().min(2).max(60),
        parent_id: z.union([z.uuid(), z.literal("")]),
      })
      .parse(Object.fromEntries(form));
    const r = await db
      .from(v.parent_id ? "service_variants" : "services")
      .insert({
        salon_id: salon.id,
        slug: crypto.randomUUID(),
        name: v.name,
        category: v.category,
        pricing_type: "consultation",
        price_cents: null,
        duration_minutes: null,
        ...(v.parent_id ? { service_id: v.parent_id } : {}),
      });
    check(r.error);
    revalidatePath("/admin/services");
    return {
      message:
        "Draft created. Set price, duration and availability in the catalog below.",
      saved: true,
    };
  } catch (e) {
    return fail(e);
  }
}
