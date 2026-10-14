import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  renderMessage,
  type MessagePayload,
} from "../lib/communications/templates";
import {
  ResendAdapter,
  TwilioAdapter,
  verifyTwilio,
} from "../lib/communications/adapters";
import {
  integrationSchema,
  emailReady,
  smsReady,
  paymentsReady,
} from "../lib/integration-config";
import { preferenceToken, verifyPreference } from "../lib/capabilities";
const p: MessagePayload = {
  name: "<script>Customer</script>",
  email: "fixture@example.invalid",
  phone: "+15550000000",
  starts_at: "2026-11-03T15:00:00Z",
  ends_at: "2026-11-03T15:30:00Z",
  reference: "fixture",
  service: "Haircut & style",
  salon: "Jaz It Up Beauty Lounge",
  timezone: "America/Chicago",
  salon_phone: "555-000-0000",
  salon_email: "fixture@example.invalid",
  address: "Fixture address",
};
test("branded messages include service, Chicago local time, contact details and escaped text", () => {
  for (const kind of [
    "confirmation",
    "reschedule",
    "cancellation",
    "reminder",
  ] as const) {
    const m = renderMessage(
      kind,
      p,
      "https://example.invalid/preferences#token",
    );
    assert.match(m.text, /Haircut & style/);
    assert.match(m.text, /9:00 AM CST/);
    assert.match(m.text, /Jaz It Up/);
    assert.match(m.text, /555-000-0000/);
    assert.match(m.html, /&lt;script&gt;/);
    assert.doesNotMatch(m.html, /<script>/);
    assert.match(m.html, /<a href=/);
    assert.match(m.sms, /STOP/);
  }
});
test("provider and payment integration switches fail closed with missing credentials", () => {
  const empty = integrationSchema.parse({});
  assert.equal(emailReady(empty), false);
  assert.equal(smsReady(empty), false);
  assert.equal(paymentsReady(empty), false);
  const flags = integrationSchema.parse({
    NOTIFICATIONS_ENABLED: "true",
    EMAIL_PROVIDER: "resend",
    SMS_ENABLED: "true",
    PAYMENTS_ENABLED: "true",
  });
  assert.equal(emailReady(flags), false);
  assert.equal(smsReady(flags), false);
  assert.equal(paymentsReady(flags), false);
  assert.throws(() => integrationSchema.parse({ PAYMENTS_ENABLED: "yes" }));
});
test("preference links reject tampering and expiry", () => {
  const secret = "fixture-only-secret".repeat(3),
    id = "b7a75910-dfb2-4d28-b2eb-b7d31cc42393",
    token = preferenceToken(id, 2000000000, secret);
  assert.equal(verifyPreference(token, secret, 1000), id);
  assert.equal(verifyPreference(token + "bad", secret, 1000), null);
  assert.equal(verifyPreference(token, secret, 2000000000001), null);
});
test("email retries retain provider idempotency key and immutable body", async () => {
  const bodies: string[] = [],
    keys: string[] = [];
  let delivered = 0;
  const known = new Set();
  const fake = async (_url: unknown, init?: RequestInit) => {
    const key = (init!.headers as Record<string, string>)["Idempotency-Key"];
    keys.push(key);
    bodies.push(init!.body as string);
    if (!known.has(key)) {
      known.add(key);
      delivered++;
    }
    return Response.json({ id: "email_fixture" });
  };
  const a = new ResendAdapter("fixture", fake as typeof fetch),
    body = { to: p.email!, from: "fixture@example.invalid", text: "Fixture" };
  await a.send("stable-job-id", body);
  await a.send("stable-job-id", body);
  assert.equal(delivered, 1);
  assert.deepEqual(keys, ["stable-job-id", "stable-job-id"]);
  assert.equal(bodies[0], bodies[1]);
});
test("email transient errors retry, permanent errors fail, acceptance is not delivery", async () => {
  for (const [status, state] of [
    [429, "retry"],
    [503, "retry"],
    [422, "failed"],
  ] as const) {
    const a = new ResendAdapter(
      "fixture",
      (async () => new Response(null, { status })) as typeof fetch,
    );
    assert.equal(
      (await a.send("id", { to: p.email!, text: "fixture" })).state,
      state,
    );
  }
  const ok = new ResendAdapter("fixture", (async () =>
    Response.json({ id: "accepted" })) as typeof fetch);
  assert.equal(
    (await ok.send("id", { to: p.email!, text: "fixture" })).state,
    "accepted",
  );
});
test("SMS timeouts never authorize an automatic resend", async () => {
  let calls = 0;
  const a = new TwilioAdapter("fixture", "fixture", (async () => {
    calls++;
    throw Error("network timeout");
  }) as typeof fetch);
  const r = await a.send("id", { to: p.phone, text: "fixture" });
  assert.equal(r.state, "unknown");
  assert.equal(calls, 1);
});
test("SMS callback authentication covers exact canonical URL and all fields", () => {
  const url = "https://example.invalid/api/webhooks/twilio",
    params = { AccountSid: "AC_fixture", From: p.phone, OptOutType: "STOP" },
    secret = "fixture";
  const s = createHmac("sha1", secret)
    .update(
      url +
        Object.keys(params)
          .sort()
          .map((k) => k + params[k as keyof typeof params])
          .join(""),
    )
    .digest("base64");
  assert.equal(verifyTwilio(url, params, s, secret), true);
  assert.equal(
    verifyTwilio(url, { ...params, OptOutType: "START" }, s, secret),
    false,
  );
});
