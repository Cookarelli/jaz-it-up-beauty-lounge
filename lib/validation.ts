import { z } from "zod";
export const bookingSchema = z.object({
  service_id: z.uuid(),
  stylist_id: z.uuid(),
  starts_at: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(30),
  website: z.string().max(0).optional(),
});
export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  category: z.string().trim().min(1).max(100),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  price_cents: z.coerce.number().int().min(0).max(1000000),
});
