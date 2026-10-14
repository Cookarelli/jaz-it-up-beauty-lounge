import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDate,
  localToISO,
  calendarRange,
  localInput,
  validDate,
  overlapsDay,
  calendarHref,
  clockLabel,
} from "../lib/admin-time";
import {
  customerSchema,
  appointmentSchema,
  hoursSchema,
  closureSchema,
  profileSchema,
  policySchema,
} from "../lib/admin-validation";
import { salonDayBounds } from "../lib/time";
test("salon date uses salon timezone instead of UTC day", () =>
  assert.equal(
    localDate("2026-10-15T02:00:00Z", "America/Chicago"),
    "2026-10-14",
  ));
test("local appointments round trip across standard and daylight time", () => {
  for (const [local, utc] of [
    ["2026-01-14T10:30", "2026-01-14T16:30:00.000Z"],
    ["2026-07-14T10:30", "2026-07-14T15:30:00.000Z"],
  ]) {
    assert.equal(localToISO(local, "America/Chicago"), utc);
    assert.equal(localInput(utc, "America/Chicago"), local);
  }
});
test("DST gaps and repeated times are rejected instead of guessed", () => {
  for (const local of ["2026-03-08T02:30", "2026-11-01T01:30"])
    assert.throws(
      () => localToISO(local, "America/Chicago"),
      /daylight saving/,
    );
});
test("daily bounds respect 23 and 25 hour days", () => {
  for (const [date, hours] of [
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ] as const) {
    const b = salonDayBounds(date);
    assert.equal((Date.parse(b.end) - Date.parse(b.start)) / 3600000, hours);
  }
});
test("calendar covers full month and week boundaries", () => {
  assert.equal(calendarRange("2028-02-20", "month").days.length, 29);
  assert.deepEqual(calendarRange("2026-10-14", "week").days, [
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
  ]);
  assert.equal(validDate("2026-02-31"), false);
});
test("walk-in customers can omit email without inventing one", () => {
  const r = customerSchema.parse({
    name: "Test customer",
    email: "",
    phone: "",
    notes: "",
  });
  assert.equal(r.email, null);
  assert.equal(
    customerSchema.safeParse({ ...r, email: "invalid" }).success,
    false,
  );
});
test("manual booking requires explicit duration and estimate", () => {
  const base = {
    starts_at: "2026-10-14T10:00",
    duration_minutes: 30,
    price_cents: 0,
    notes: "",
    status: "confirmed",
  };
  assert.equal(appointmentSchema.safeParse(base).success, true);
  for (const change of [
    { price_cents: "" },
    { duration_minutes: "" },
    { duration_minutes: 481 },
    { price_cents: -1 },
    { status: "paid" },
  ])
    assert.equal(
      appointmentSchema.safeParse({ ...base, ...change }).success,
      false,
    );
});
test("working hours and closures validate time order", () => {
  assert.equal(
    hoursSchema.safeParse({ weekday: 1, opens_at: "17:00", closes_at: "09:00" })
      .success,
    false,
  );
  assert.equal(
    closureSchema.safeParse({
      on_date: "2026-02-31",
      closed: true,
      opens_at: "",
      closes_at: "",
      note: "",
    }).success,
    false,
  );
  assert.equal(
    closureSchema.safeParse({
      on_date: "2026-10-14",
      closed: false,
      opens_at: "",
      closes_at: "",
      note: "",
    }).success,
    false,
  );
});
test("public links reject executable and insecure schemes", () => {
  const base = {
    phone: "",
    email: "",
    address: "",
    instagram_url: "",
    facebook_url: "",
    hero_title: "Welcome",
    hero_text: "",
    about_text: "",
  };
  assert.equal(profileSchema.safeParse(base).success, true);
  for (const link of ["javascript:alert(1)", "http://example.com"])
    assert.equal(
      profileSchema.safeParse({ ...base, instagram_url: link }).success,
      false,
    );
});
test("future deposit rules cannot imply a charged payment", () => {
  const base = {
    minimum_notice_minutes: 120,
    maximum_advance_days: 90,
    slot_interval_minutes: 30,
    cancellation_notice_hours: "",
    cancellation_text: "",
    deposit_type: "none",
    deposit_value: "",
  };
  assert.equal(policySchema.parse(base).deposit_value, null);
  for (const change of [
    { deposit_type: "percent", deposit_value: 101 },
    { deposit_type: "fixed", deposit_value: "" },
    { deposit_type: "none", deposit_value: 100 },
  ])
    assert.equal(policySchema.safeParse({ ...base, ...change }).success, false);
  assert.equal(
    "payments_enabled" in
      policySchema.parse({ ...base, payments_enabled: true }),
    false,
  );
});

test("Chicago 9 AM stays local across both DST transition weekends", () => {
  for (const [day, utc] of [
    ["2027-03-13", "2027-03-13T15:00:00.000Z"],
    ["2027-03-16", "2027-03-16T14:00:00.000Z"],
    ["2026-10-31", "2026-10-31T14:00:00.000Z"],
    ["2026-11-03", "2026-11-03T15:00:00.000Z"],
  ]) {
    assert.equal(localToISO(`${day}T09:00`, "America/Chicago"), utc);
    assert.equal(localInput(utc, "America/Chicago"), `${day}T09:00`);
  }
});

test("calendar blocks use exclusive ends, including Chicago DST days", () => {
  const zone = "America/Chicago";
  assert.equal(
    overlapsDay(
      "2026-10-14T22:00:00Z",
      "2026-10-15T05:00:00Z",
      "2026-10-15",
      zone,
    ),
    false,
  );
  assert.equal(
    overlapsDay(
      "2026-10-14T22:00:00Z",
      "2026-10-15T05:00:01Z",
      "2026-10-15",
      zone,
    ),
    true,
  );
  assert.equal(
    overlapsDay(
      "2026-11-01T05:00:00Z",
      "2026-11-02T06:00:00Z",
      "2026-11-01",
      zone,
    ),
    true,
  );
  assert.equal(
    overlapsDay(
      "2026-11-01T05:00:00Z",
      "2026-11-02T06:00:00Z",
      "2026-11-02",
      zone,
    ),
    false,
  );
});
test("calendar navigation retains stylist and formats owner hours", () => {
  const query = new URLSearchParams(
    calendarHref("2026-10-17", "day", "stylist-1").slice(1),
  );
  assert.equal(query.get("stylist"), "stylist-1");
  assert.equal(query.get("date"), "2026-10-17");
  assert.equal(clockLabel("09:00:00"), "9:00 AM");
  assert.equal(clockLabel("19:00:00"), "7:00 PM");
  assert.equal(clockLabel("15:00:00"), "3:00 PM");
});
