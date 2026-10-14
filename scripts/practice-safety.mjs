// Deliberately separate from hosted configuration. This is a local-only tool.
export const practiceOrigin = "http://127.0.0.1:3100";
export const practiceDatabase = "http://127.0.0.1:54321";
export const practiceProject = "jaz-local-practice";
export const practiceContext = "colima-jaz-practice";
export function cleanEnvironment(source = process.env) {
  return Object.fromEntries(
    ["PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG", "TERM", "SystemRoot"]
      .filter((key) => source[key])
      .map((key) => [key, source[key]]),
  );
}
export function localDockerHost(context) {
  const host = context?.Endpoints?.docker?.Host;
  if (context?.Name !== practiceContext || !host?.startsWith("unix:///"))
    throw Error("Practice requires the local colima-jaz-practice Docker context.");
  return host;
}
export function verifyBindings(containers) {
  if (!containers.length) throw Error("Practice containers are not running.");
  for (const container of containers) {
    for (const bindings of Object.values(container.NetworkSettings?.Ports || {})) {
      for (const binding of bindings || []) {
        if (!["127.0.0.1", "::1"].includes(binding.HostIp))
          throw Error("Practice stopped: a container port was not bound to loopback.");
      }
    }
  }
}
export function practiceEnvironment(config, source = process.env) {
  if (
    config.NEXT_PUBLIC_SITE_URL !== practiceOrigin ||
    config.NEXT_PUBLIC_SUPABASE_URL !== practiceDatabase ||
    !config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !config.SUPABASE_SECRET_KEY ||
    !config.BOOKING_RATE_LIMIT_SECRET ||
    !config.E2E_PASSWORD
  ) throw Error("Refusing incomplete or non-local practice credentials.");
  return {
    ...cleanEnvironment(source),
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: practiceOrigin,
    NEXT_PUBLIC_SUPABASE_URL: practiceDatabase,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: config.SUPABASE_SECRET_KEY,
    BOOKING_RATE_LIMIT_SECRET: config.BOOKING_RATE_LIMIT_SECRET,
    // The actual booking route is usable only on this loopback-bound copy.
    PUBLIC_BOOKING_ENABLED: "true",
    SITE_INDEXING_ENABLED: "false",
    NOTIFICATIONS_ENABLED: "false",
    EMAIL_PROVIDER: "disabled",
    SMS_ENABLED: "false",
    PAYMENTS_ENABLED: "false",
    STRIPE_MODE: "test",
  };
}
