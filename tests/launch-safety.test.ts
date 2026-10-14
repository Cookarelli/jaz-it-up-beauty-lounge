import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingReady,
  indexingAllowed,
  launchSchema,
} from "../lib/launch-config";
import { boundedJson, rateKey, RequestProblem } from "../lib/http-safety";
import { localDate } from "../lib/admin-time";
test("public booking stays closed until explicit enablement and complete runtime configuration", () => {
  const disabled = launchSchema.parse({});
  assert.equal(bookingReady(disabled, true, "https://example.invalid"), false);
  const enabled = launchSchema.parse({
    PUBLIC_BOOKING_ENABLED: "true",
    BOOKING_RATE_LIMIT_SECRET: "synthetic".repeat(6),
  });
  assert.equal(bookingReady(enabled, false, "https://example.invalid"), false);
  assert.equal(bookingReady(enabled, true, "http://example.invalid"), false);
  assert.equal(bookingReady(enabled, true, "https://example.invalid"), true);
  assert.equal(
    bookingReady(
      launchSchema.parse({ PUBLIC_BOOKING_ENABLED: "true" }),
      true,
      "https://example.invalid",
    ),
    false,
  );
  assert.throws(() => launchSchema.parse({ PUBLIC_BOOKING_ENABLED: "yes" }));
});
test("previews and local sites cannot opt into indexing", () => {
  assert.equal(
    indexingAllowed(true, "https://example.invalid", "preview"),
    false,
  );
  assert.equal(indexingAllowed(true, "http://localhost:3000"), false);
  assert.equal(
    indexingAllowed(false, "https://example.invalid", "production"),
    false,
  );
  assert.equal(
    indexingAllowed(true, "https://example.invalid", "production"),
    true,
  );
});
test("body limit handles declared, actual and chunked oversize without parsing it", async () => {
  const request = (body: string, length?: string) =>
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(length ? { "content-length": length } : {}),
      },
      body,
    });
  assert.deepEqual(await boundedJson(request('{"ok":true}'), 20), { ok: true });
  for (const req of [
    request('"small"', "10000"),
    request('"' + "a".repeat(1000) + '"'),
  ]) {
    await assert.rejects(
      boundedJson(req, 20),
      (e: unknown) => e instanceof RequestProblem && e.status === 413,
    );
  }
  await assert.rejects(
    boundedJson(request("bad")),
    (e: unknown) => e instanceof RequestProblem && e.status === 400,
  );
  await assert.rejects(
    boundedJson(
      new Request("http://localhost", { method: "POST", body: "{}" }),
    ),
    (e: unknown) => e instanceof RequestProblem && e.status === 415,
  );
});
test("IP limiter ignores forged forwarding headers outside the configured platform", () => {
  const secret = "synthetic".repeat(6);
  const a = new Request("http://localhost", {
    headers: { "x-forwarded-for": "203.0.113.1" },
  });
  const b = new Request("http://localhost", {
    headers: { "x-forwarded-for": "203.0.113.2" },
  });
  assert.equal(rateKey(a, secret, false), rateKey(b, secret, false));
  assert.match(rateKey(a, secret, false), /^[a-f0-9]{64}$/);
  assert.throws(() =>
    rateKey(
      new Request("https://example.invalid", {
        headers: { "x-forwarded-for": "203.0.113.1" },
      }),
      secret,
      true,
    ),
  );
  const platform = new Request("https://example.invalid", {
    headers: { "x-vercel-forwarded-for": "203.0.113.1" },
  });
  assert.notEqual(
    rateKey(platform, secret, true),
    rateKey(platform, secret + "different", true),
  );
});
test("booking minimum date follows Chicago near UTC midnight", () => {
  assert.equal(localDate("2026-10-15T00:30:00Z"), "2026-10-14");
  assert.equal(localDate("2026-11-02T05:30:00Z"), "2026-11-01");
});
