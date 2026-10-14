import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingSchema, serviceSchema } from "../lib/validation";
import { salonDayBounds } from "../lib/time";
const valid = {
  service_id: "c68dfdab-1ee9-4a19-82b2-87d8acbb5a64",
  stylist_id: "8d243302-42a6-42f3-8cf9-39f63ea9114e",
  starts_at: "2026-11-10T10:00:00-06:00",
  name: "Test Person",
  email: "test@example.invalid",
  phone: "5551234567",
  website: "",
};
test("guest booking validates without an account", () =>
  assert.equal(bookingSchema.safeParse(valid).success, true));
test("rejects malformed input and bot honeypot", () => {
  for (const update of [
    { email: "bad" },
    { service_id: "cut" },
    { website: "spam" },
    { name: "" },
    { starts_at: "tomorrow" },
  ])
    assert.equal(
      bookingSchema.safeParse({ ...valid, ...update }).success,
      false,
    );
});
test("catalog forbids negative prices and invalid durations", () => {
  assert.equal(
    serviceSchema.safeParse({
      name: "Cut",
      description: "",
      category: "Hair",
      duration_minutes: 0,
      price_cents: -1,
    }).success,
    false,
  );
});
test("calendar day boundaries handle spring and autumn DST", () => {
  for (const [date, hours] of [
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ] as const) {
    const b = salonDayBounds(date);
    assert.equal((Date.parse(b.end) - Date.parse(b.start)) / 3600000, hours);
  }
});
