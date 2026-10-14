"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminContext } from "@/lib/admin";
import { privilegedClient } from "@/lib/supabase";
import { integrations } from "@/lib/integrations";
import { emailReady, smsReady, paymentsReady } from "@/lib/integration-config";
import {
  verifyStripeInfrastructure,
  credentialFingerprint,
} from "@/lib/payments/stripe";
import { policySchema, type AdminState } from "@/lib/admin-validation";
async function ownerContext() {
  const c = await adminContext();
  const { data } = await c.db.auth.getUser();
  const role = await c.db
    .from("staff_roles")
    .select("role")
    .eq("salon_id", c.salon.id)
    .eq("user_id", data.user!.id)
    .single();
  if (role.error || role.data.role !== "owner")
    throw Error("Only the salon owner can change these settings.");
  return c;
}
function failure(e: unknown): AdminState {
  return {
    message:
      e instanceof z.ZodError
        ? e.issues.map((x) => x.message).join(" ")
        : e instanceof Error
          ? e.message
          : "Settings unavailable.",
  };
}
export async function saveCommunications(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  try {
    const { db, salon } = await ownerContext();
    const enabled = (key: string) => form.get(key) === "on";
    const minutes = z
      .array(z.coerce.number().int().min(30).max(10080))
      .min(1)
      .max(3)
      .parse(
        String(form.get("reminder_minutes"))
          .split(",")
          .map((x) => x.trim()),
      );
    if (new Set(minutes).size !== minutes.length)
      throw Error("Reminder times must be unique.");
    if (enabled("email_enabled") && !emailReady(integrations))
      throw Error(
        "Configure and enable the email provider in the server environment first.",
      );
    if (enabled("sms_enabled") && !smsReady(integrations))
      throw Error(
        "Configure SMS, sender registration and STOP handling before enabling texts.",
      );
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const r = await db
      .from("communication_settings")
      .update({
        email_enabled: enabled("email_enabled"),
        sms_enabled: enabled("sms_enabled"),
        reminders_enabled: enabled("reminders_enabled"),
        reminder_minutes: minutes,
      })
      .eq("salon_id", salon.id)
      .eq("revision", revision)
      .select("salon_id")
      .maybeSingle();
    if (r.error || !r.data)
      throw Error(
        "Settings changed or could not be saved. Reload before retrying.",
      );
    revalidatePath("/admin/communications");
    return {
      message:
        "Communication preferences saved. Only consenting customers receive optional reminders or texts.",
      saved: true,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function verifyPayments(
  _: AdminState,
  _form: FormData,
): Promise<AdminState> {
  void _form;
  try {
    const { salon } = await ownerContext();
    const verified = await verifyStripeInfrastructure();
    const db = privilegedClient();
    const old = await db
      .from("payment_readiness")
      .select("credential_fingerprint,webhook_seen_at")
      .eq("salon_id", salon.id)
      .maybeSingle();
    if (old.error) throw old.error;
    const r = await db.from("payment_readiness").upsert({
      salon_id: salon.id,
      ...verified,
      webhook_seen_at:
        old.data?.credential_fingerprint === verified.credential_fingerprint
          ? old.data.webhook_seen_at
          : null,
    });
    if (r.error) throw Error("Could not record verification.");
    revalidatePath("/admin/payments");
    return {
      message:
        "Stripe account and endpoint verified. A correctly signed webhook must also reach this deployment before activation.",
      saved: true,
    };
  } catch {
    return {
      message:
        "Stripe verification failed. Check the server keys, mode, HTTPS site URL, account activation, webhook URL and subscribed events.",
    };
  }
}
export async function savePayments(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  try {
    const { db, salon } = await ownerContext();
    const values = policySchema.parse(Object.fromEntries(form));
    const refund = z
      .object({
        refund_policy: z.string().trim().max(3000),
        refund_mode: z.enum([
          "manual_review",
          "refundable_before_deadline",
          "nonrefundable",
        ]),
      })
      .parse(Object.fromEntries(form));
    const enabled = form.get("payments_enabled") === "on";
    if (enabled) {
      if (!paymentsReady(integrations))
        throw Error(
          "Server payment switch and matching Stripe credentials are required.",
        );
      if (
        values.deposit_type === "none" ||
        !values.deposit_value ||
        refund.refund_policy.length < 10 ||
        values.cancellation_text.length < 10 ||
        values.cancellation_notice_hours === null
      )
        throw Error(
          "Choose a positive deposit, cancellation deadline, and clear cancellation/refund terms first.",
        );
      const readiness = await db
        .from("payment_readiness")
        .select("credential_fingerprint,verified_at,webhook_seen_at")
        .eq("salon_id", salon.id)
        .single();
      if (
        readiness.error ||
        !readiness.data.verified_at ||
        !readiness.data.webhook_seen_at ||
        readiness.data.credential_fingerprint !== credentialFingerprint()
      )
        throw Error(
          "Verify the current Stripe configuration and a signed webhook first.",
        );
    }
    const revision = z.coerce
      .number()
      .int()
      .positive()
      .parse(form.get("revision"));
    const r = await db
      .from("booking_policies")
      .update({ ...values, ...refund, payments_enabled: enabled })
      .eq("salon_id", salon.id)
      .eq("revision", revision)
      .select("salon_id")
      .maybeSingle();
    if (r.error || !r.data)
      throw Error("Policy changed or validation failed. Reload before saving.");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/settings");
    return {
      message: enabled
        ? "Deposits enabled for new online bookings. Existing bookings are unchanged."
        : "Policy saved. Online booking requires no deposit.",
      saved: true,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function retryMessage(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  try {
    const { salon } = await ownerContext();
    const id = z.uuid().parse(form.get("id"));
    const db = privilegedClient();
    const j = await db
      .from("notification_jobs")
      .select("id,first_attempt_at,expires_at,attempts,channel,state")
      .eq("salon_id", salon.id)
      .eq("id", id)
      .single();
    if (
      j.error ||
      j.data.channel !== "email" ||
      j.data.state !== "failed" ||
      j.data.attempts >= 8 ||
      Date.parse(j.data.expires_at) <= Date.now() ||
      Date.parse(j.data.first_attempt_at) < Date.now() - 23 * 3600000
    )
      throw Error(
        "This message cannot be retried safely. Reconcile its provider record; unknown or expired sends must not be replayed.",
      );
    const r = await db
      .from("notification_jobs")
      .update({ state: "retry", locked_until: null })
      .eq("id", id)
      .eq("salon_id", salon.id)
      .eq("state", "failed");
    if (r.error) throw Error("Retry unavailable");
    const audit = await db
      .from("notification_events")
      .insert({ job_id: id, event_type: "owner_retry", idempotency_key: id });
    if (audit.error) throw Error("Retry logging unavailable");
    revalidatePath("/admin/communications");
    return {
      message: "Queued with its original message and idempotency key.",
      saved: true,
    };
  } catch (e) {
    return failure(e);
  }
}

export async function stopMessages(
  _: AdminState,
  form: FormData,
): Promise<AdminState> {
  try {
    const { salon } = await ownerContext();
    const id = z.uuid().parse(form.get("id")),
      channel = z.enum(["email", "sms"]).parse(form.get("channel"));
    const db = privilegedClient();
    const a = await db
      .from("appointments")
      .select("email,phone,services!inner(salon_id)")
      .eq("id", id)
      .eq("services.salon_id", salon.id)
      .single();
    if (a.error) throw Error("Appointment unavailable.");
    const target = channel === "email" ? a.data.email : a.data.phone;
    if (!target) throw Error("No contact supplied.");
    const r = await db.rpc("suppress_contact", {
      p_salon: salon.id,
      p_channel: channel,
      p_target: target,
      p_reason: "customer_opt_out",
    });
    if (r.error) throw Error("Preference could not be saved.");
    revalidatePath(`/admin/appointments/${id}`);
    revalidatePath("/admin/communications");
    return {
      message:
        "Messages to this contact have been stopped. The appointment is unchanged.",
      saved: true,
    };
  } catch (e) {
    return failure(e);
  }
}
