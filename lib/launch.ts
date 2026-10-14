import "server-only";
import { env, configured } from "./env";
import { launchSchema, bookingReady, indexingAllowed } from "./launch-config";
export const launch = launchSchema.parse(
  Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
);
export const onlineBookingReady = bookingReady(
  launch,
  configured && !!env.SUPABASE_SECRET_KEY,
  env.NEXT_PUBLIC_SITE_URL,
);
export const canIndex = indexingAllowed(
  launch.SITE_INDEXING_ENABLED,
  env.NEXT_PUBLIC_SITE_URL,
  process.env.VERCEL_ENV,
);
