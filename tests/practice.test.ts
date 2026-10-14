import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanEnvironment, localDockerHost, practiceEnvironment, verifyBindings,
} from "../scripts/practice-safety.mjs";
const credentials = {
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fake-local-public-key",
  SUPABASE_SECRET_KEY: "fake-local-server-key",
  BOOKING_RATE_LIMIT_SECRET: "fake-local-rate-limit-key",
  E2E_PASSWORD: "fake-random-password-for-unit-test-only",
};
test("practice refuses hosted and lookalike database/app origins", () => {
  for (const url of ["https://fwxothhjxtvuupyeqsri.supabase.co", "http://127.0.0.1.evil.example:54321", "http://localhost:54321", "http://127.0.0.1:54321/other"])
    assert.throws(() => practiceEnvironment({ ...credentials, NEXT_PUBLIC_SUPABASE_URL: url }));
  assert.throws(() => practiceEnvironment({ ...credentials, NEXT_PUBLIC_SITE_URL: "https://example.com" }));
  assert.throws(() => practiceEnvironment({ ...credentials, SUPABASE_SECRET_KEY: "" }));
});
test("practice strips inherited cloud credentials and forces delivery/payment gates off", () => {
  const hostile: NodeJS.ProcessEnv = { NODE_ENV: "production", PATH: "/usr/bin", SUPABASE_ACCESS_TOKEN: "cloud-token", STRIPE_SECRET_KEY: "sk_live_fake", RESEND_API_KEY: "fake", CRON_SECRET: "fake", NODE_OPTIONS: "--require=/untrusted.js", VERCEL: "1", PAYMENTS_ENABLED: "true" };
  assert.deepEqual(cleanEnvironment(hostile), { PATH: "/usr/bin" });
  const env = practiceEnvironment({ ...credentials, NOTIFICATIONS_ENABLED: "true", PAYMENTS_ENABLED: "true", SMS_ENABLED: "true", SITE_INDEXING_ENABLED: "true", RESEND_API_KEY: "fake" }, hostile);
  assert.equal(env.PUBLIC_BOOKING_ENABLED, "true");
  for (const key of ["NOTIFICATIONS_ENABLED", "PAYMENTS_ENABLED", "SMS_ENABLED", "SITE_INDEXING_ENABLED"])
    assert.equal(env[key as keyof typeof env], "false");
  for (const key of ["STRIPE_SECRET_KEY", "RESEND_API_KEY", "CRON_SECRET", "SUPABASE_ACCESS_TOKEN", "NODE_OPTIONS", "E2E_PASSWORD"])
    assert.equal(key in env, false);
});
test("practice rejects remote and unexpected Docker contexts", () => {
  const context = { Name: "colima-jaz-practice", Endpoints: { docker: { Host: "unix:///local/docker.sock" } } };
  assert.equal(localDockerHost(context), "unix:///local/docker.sock");
  assert.throws(() => localDockerHost({ ...context, Name: "production" }));
  for (const Host of ["tcp://host:2376", "ssh://host", "http://localhost:2375"])
    assert.throws(() => localDockerHost({ ...context, Endpoints: { docker: { Host } } }));
});
test("practice rejects LAN-exposed ports and a missing stack", () => {
  const containers = (HostIp: string) => [{ NetworkSettings: { Ports: { "5432/tcp": [{ HostIp, HostPort: "54322" }], "8000/tcp": null } } }];
  assert.doesNotThrow(() => verifyBindings(containers("127.0.0.1")));
  assert.doesNotThrow(() => verifyBindings(containers("::1")));
  for (const host of ["0.0.0.0", "::", "", "192.168.1.10"])
    assert.throws(() => verifyBindings(containers(host)));
  assert.throws(() => verifyBindings([]));
});
