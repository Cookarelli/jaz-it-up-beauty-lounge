import { z } from "zod";
const nullableInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(min).max(max).nullable(),
  );
const checkbox = z.preprocess((v) => v === true || v === "on", z.boolean());
export const bookingSchema = z.object({
  service_id: z.uuid(),
  variant_id: z.uuid().nullable().optional(),
  stylist_id: z.uuid(),
  starts_at: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(30),
  website: z.string().max(0).optional(),
});
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500),
    pricing_type: z.enum(["exact", "starting", "range", "consultation"]),
    price_cents: nullableInt(0, 1000000),
    price_max_cents: nullableInt(0, 1000000),
    duration_minutes: nullableInt(1, 480),
    duration_min_minutes: nullableInt(1, 480),
    duration_max_minutes: nullableInt(1, 480),
    price_approved: checkbox,
    duration_approved: checkbox,
    status: z.enum(["draft", "published", "archived"]),
    length_qualification: z.enum([
      "any",
      "above_shoulder",
      "shoulder",
      "below_shoulder",
      "up_to_shoulder",
    ]),
    display_order: z.coerce.number().int().min(0).max(10000),
    preparation_minutes: z.coerce.number().int().min(0).max(120),
    cleanup_minutes: z.coerce.number().int().min(0).max(120),
    admin_notes: z.string().trim().max(2000),
  })
  .superRefine((v, c) => {
    const err = (path: string, message: string) =>
      c.addIssue({ code: "custom", path: [path], message });
    if (v.pricing_type === "consultation") {
      if (
        v.price_cents !== null ||
        v.price_max_cents !== null ||
        v.price_approved
      )
        err(
          "price_cents",
          "Consultation pricing must leave prices blank and unapproved.",
        );
    } else if (v.price_cents === null)
      err("price_cents", "Enter an explicit price in cents.");
    if (v.pricing_type === "range") {
      if (
        v.price_max_cents === null ||
        v.price_cents === null ||
        v.price_max_cents < v.price_cents
      )
        err(
          "price_max_cents",
          "Enter a maximum at least equal to the minimum.",
        );
    } else if (v.price_max_cents !== null)
      err("price_max_cents", "Only range pricing has a maximum.");
    if (v.duration_approved && v.duration_minutes === null)
      err(
        "duration_minutes",
        "Approve a specific duration before enabling booking.",
      );
    if (
      v.duration_min_minutes !== null &&
      v.duration_max_minutes !== null &&
      v.duration_max_minutes < v.duration_min_minutes
    )
      err("duration_max_minutes", "Maximum must be at least the minimum.");
  });
export type ServiceFormState = {
  message: string;
  errors?: Record<string, string[]>;
  saved?: boolean;
};
