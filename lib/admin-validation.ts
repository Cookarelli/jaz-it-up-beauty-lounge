import { z } from "zod";
import { validDate } from "./admin-time";
const optionalEmail = z
  .union([z.literal(""), z.email().max(254)])
  .transform((v) => v ? v.toLowerCase() : null);
const integer = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(min).max(max),
  );
export const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: optionalEmail,
  phone: z.string().trim().max(30),
  notes: z.string().trim().max(2000),
});
export const appointmentSchema = z.object({
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  duration_minutes: integer(1, 480),
  price_cents: integer(0, 1000000),
  notes: z.string().trim().max(2000),
  status: z
    .enum(["confirmed", "cancelled", "completed", "no_show"])
    .default("confirmed"),
});
export const hoursSchema = z
  .object({
    weekday: integer(0, 6),
    opens_at: z.string().regex(/^\d{2}:\d{2}$/),
    closes_at: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((v) => v.opens_at < v.closes_at, {
    message: "Closing time must follow opening time.",
    path: ["closes_at"],
  });
export const closureSchema = z
  .object({
    on_date: z.string().refine(validDate, "Choose a valid date."),
    closed: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    opens_at: z.string(),
    closes_at: z.string(),
    note: z.string().trim().max(500),
  })
  .superRefine((v, c) => {
    if (
      !v.closed &&
      (!/^\d{2}:\d{2}$/.test(v.opens_at) ||
        !/^\d{2}:\d{2}$/.test(v.closes_at) ||
        v.opens_at >= v.closes_at)
    )
      c.addIssue({
        code: "custom",
        path: ["opens_at"],
        message:
          "Choose opening and closing times in order, or select closed all day.",
      });
  });
const social = z.union([
  z.literal(""),
  z
    .url()
    .max(500)
    .refine((v) => new URL(v).protocol === "https:", "Use an HTTPS link."),
]);
export const profileSchema = z.object({
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.email().max(254)]),
  address: z.string().trim().max(500),
  instagram_url: social,
  facebook_url: social,
  hero_title: z.string().trim().min(2).max(160),
  hero_text: z.string().trim().max(1000),
  about_text: z.string().trim().max(2000),
});
export const policySchema = z
  .object({
    minimum_notice_minutes: integer(0, 10080),
    maximum_advance_days: integer(1, 365),
    slot_interval_minutes: integer(5, 120),
    cancellation_notice_hours: z.preprocess(
      (v) => (v === "" ? null : v),
      z.coerce.number().int().min(0).max(8760).nullable(),
    ),
    cancellation_text: z.string().trim().max(3000),
    deposit_type: z.enum(["none", "fixed", "percent"]),
    deposit_value: z.preprocess(
      (v) => (v === "" ? null : v),
      z.coerce.number().int().min(0).max(1000000).nullable(),
    ),
  })
  .superRefine((v, c) => {
    if (
      (v.deposit_type === "none" && v.deposit_value !== null) ||
      (v.deposit_type !== "none" && v.deposit_value === null) ||
      (v.deposit_type === "percent" &&
        (v.deposit_value! < 1 || v.deposit_value! > 100))
    )
      c.addIssue({
        code: "custom",
        path: ["deposit_value"],
        message:
          "Leave blank for none; enter cents for fixed or 1–100 for percent.",
      });
  });
export type AdminState = {
  message: string;
  saved?: boolean;
  href?: string;
  errors?: Record<string, string[]>;
};
