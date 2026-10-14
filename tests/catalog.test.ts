import { test } from "node:test";
import assert from "node:assert/strict";
import menu from "../data/service-menu.json";
import { serviceSchema } from "../lib/validation";
import {
  bookable,
  bookingOptions,
  formatPrice,
  formatDuration,
  type Service,
} from "../lib/service-types";
const base = {
  ...menu.services.find((s) => s.slug === "eyebrow")!,
  id: "test",
  salon_id: "salon",
  active: true,
  revision: 1,
} as Service;
const form = { ...base, admin_notes: "" };
test("explicit zero is preserved but blank exact prices are rejected", () => {
  assert.equal(
    serviceSchema.safeParse({ ...form, price_cents: 0 }).success,
    true,
  );
  assert.equal(
    serviceSchema.safeParse({ ...form, price_cents: "" }).success,
    false,
  );
});
test("consultation and TBD remain null and cannot book", () => {
  const p = serviceSchema.parse({
    ...form,
    pricing_type: "consultation",
    price_cents: "",
    price_max_cents: "",
    price_approved: false,
    duration_minutes: "",
    duration_approved: false,
  });
  assert.equal(p.price_cents, null);
  assert.equal(p.duration_minutes, null);
  assert.equal(bookable({ ...base, ...p }), false);
});
test("approving a missing duration, invalid ranges and negative buffers fails", () => {
  for (const edit of [
    { duration_minutes: "", duration_approved: true },
    { pricing_type: "range", price_cents: 2000, price_max_cents: 1000 },
    { preparation_minutes: -1 },
    { cleanup_minutes: 121 },
    { duration_min_minutes: 120, duration_max_minutes: 90 },
  ])
    assert.equal(serviceSchema.safeParse({ ...form, ...edit }).success, false);
});
test("owner board is complete, all amounts are integer cents and provisional entries cannot book", () => {
  assert.equal(menu.services.length, 23);
  for (const s of [...menu.services, ...menu.variants]) {
    assert.equal(
      serviceSchema.safeParse({ ...s, active: true }).success,
      true,
      s.name,
    );
    if (s.price_cents !== null)
      assert.equal(Number.isInteger(s.price_cents), true);
    if (!s.price_approved || !s.duration_approved)
      assert.equal(bookable({ ...base, ...s } as Service), false, s.name);
  }
});
test("adult variants preserve the board range and separate supplied durations", () => {
  const a = menu.variants.filter((v) => v.parent_slug === "adult-haircut");
  assert.deepEqual(
    a.map((v) => v.duration_minutes),
    [30, 60],
  );
  for (const v of a) {
    assert.equal(v.price_cents, 2000);
    assert.equal(v.price_max_cents, 3000);
    assert.equal(v.price_approved, false);
    assert.equal(bookable({ ...base, ...v } as Service), false);
  }
});
test("perms have all three length choices with no invented exact timing", () => {
  const v = menu.variants.filter((v) => v.category === "PERMS");
  assert.equal(v.length, 9);
  for (const s of v) {
    assert.equal(s.duration_minutes, null);
    assert.equal(s.duration_min_minutes, 90);
    assert.equal(s.duration_max_minutes, 120);
    assert.equal(s.duration_approved, false);
  }
});
test("chemical bundles include haircut/style and cannot become component bookings", () => {
  for (const s of [...menu.services, ...menu.variants].filter(
    (s) =>
      ["COLOR", "PERMS"].includes(s.category) ||
      s.slug === "brazilian-blowout" ||
      ("parent_slug" in s && s.parent_slug === "brazilian-blowout"),
  ))
    assert.equal(s.includes_cut_style, true, s.name);
});
test("bookable parent with variants yields only approved child options", () => {
  const parent = {
    ...base,
    id: "parent",
    variants: [
      { ...base, id: "approved" },
      { ...base, id: "pending", duration_approved: false },
    ],
  };
  const options = bookingOptions([parent]);
  assert.equal(bookable(parent), false);
  assert.equal(options.length, 1);
  assert.equal(options[0].service_id, "parent");
  assert.equal(options[0].variant_id, "approved");
});
test("starting, range and provisional labels are accurate", () => {
  assert.equal(
    formatPrice({ ...base, pricing_type: "starting" }),
    "From $10.00",
  );
  assert.equal(
    formatPrice({ ...base, pricing_type: "range", price_max_cents: 1500 }),
    "$10.00–$15.00",
  );
  assert.match(
    formatDuration({ ...base, duration_minutes: 90, duration_approved: false }),
    /provisional/,
  );
});
