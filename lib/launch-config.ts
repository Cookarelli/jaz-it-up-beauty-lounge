import { z } from "zod";
const switchValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const launchSchema = z.object({
  PUBLIC_BOOKING_ENABLED: switchValue,
  SITE_INDEXING_ENABLED: switchValue,
  BOOKING_RATE_LIMIT_SECRET: z.string().min(32).optional(),
});
export type LaunchConfig = z.infer<typeof launchSchema>;
export function bookingReady(
  config: LaunchConfig,
  databaseReady: boolean,
  siteUrl: string,
) {
  const url = new URL(siteUrl);
  const secureOrigin =
    url.protocol === "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (
    config.PUBLIC_BOOKING_ENABLED &&
    databaseReady &&
    !!config.BOOKING_RATE_LIMIT_SECRET &&
    secureOrigin
  );
}
export function indexingAllowed(
  enabled: boolean,
  siteUrl: string,
  vercelEnvironment?: string,
) {
  const url = new URL(siteUrl);
  return (
    enabled &&
    url.protocol === "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    (!vercelEnvironment || vercelEnvironment === "production")
  );
}
