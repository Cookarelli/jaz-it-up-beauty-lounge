import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NOTIFICATION_WEBHOOK_URL: z.url().optional(),
  NOTIFICATION_WEBHOOK_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
});
export const env = schema.parse(
  Object.fromEntries(
    Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL,
      NOTIFICATION_WEBHOOK_TOKEN: process.env.NOTIFICATION_WEBHOOK_TOKEN,
      CRON_SECRET: process.env.CRON_SECRET,
    }).filter(([, v]) => v),
  ),
);
export const configured = !!(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
