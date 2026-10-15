import test from "node:test";
import assert from "node:assert/strict";
import menu from "../data/service-menu.json";
import { bookingOptions, type Service } from "../lib/service-types";
import { serviceSchema } from "../lib/validation";
import { configurePracticeCatalog, practiceCatalogPlan } from "../scripts/practice-catalog.mjs";

function catalog() {
  return {
    services: menu.services.map((s) => ({ ...s, id: s.slug, salon_id: "practice", active: true, revision: 1 })),
    variants: menu.variants.map((s) => ({ ...s, id: `${s.parent_slug}/${s.slug}`, service_id: s.parent_slug, salon_id: "practice", active: true, revision: 1 })),
  };
}
function configured() {
  const data = catalog();
  const plan = practiceCatalogPlan(data.services, data.variants);
  for (const edit of plan.updates) {
    const rows = edit.kind === "service" ? data.services : data.variants;
    Object.assign(rows.find((s) => s.id === edit.id)!, edit.values, { revision: edit.revision + 1 });
  }
  return data;
}

test("practice opt-in makes all 32 service choices bookable with valid, labeled values", () => {
  const before = JSON.stringify(menu);
  const baseline = catalog();
  const plan = practiceCatalogPlan(baseline.services, baseline.variants);
  assert.equal(plan.updates.length, 21);
  assert.deepEqual(plan.skipped, []);
  for (const edit of plan.updates) {
    assert.equal(serviceSchema.safeParse(edit.values).success, true, edit.key);
    assert.match(edit.values.name, /\(practice\)$/);
    assert.match(edit.values.description, /Delia must approve before launch/);
    assert.match(edit.values.admin_notes, /LOCAL PRACTICE ONLY/);
  }
  const data = configured();
  const options = bookingOptions(data.services.map((s) => ({
    ...s, variants: data.variants.filter((v) => v.service_id === s.id),
  })) as Service[]);
  assert.equal(options.length, 32);
  assert.equal(new Set(options.map((s) => s.service_id)).size, 23);
  assert.equal(JSON.stringify(menu), before, "Owner board must never be changed by practice configuration");
  for (const option of options) {
    assert.ok(option.duration_minutes! > 0);
    assert.equal(option.preparation_minutes, 0);
    assert.equal(option.cleanup_minutes, 0);
    if (["COLOR", "PERMS"].includes(option.category)) assert.equal(option.includes_cut_style, true);
  }
});
test("practice prices and timings retain the board and the approved temporary choices", () => {
  const data = configured();
  const bySlug = (slug: string) => data.services.find((s) => s.slug === slug)!;
  const cuts = data.variants.filter((s) => s.parent_slug === "adult-haircut");
  assert.deepEqual(cuts.map((s) => s.duration_minutes), [30, 60]);
  for (const s of cuts) {
    assert.equal(s.price_cents, 2000);
    assert.equal(s.pricing_type, "starting");
  }
  for (const [slug, duration, price] of [
    ["kids-haircut", 30, 1000], ["beard-mustache", 15, 500],
    ["extra-design", 30, 1000], ["retouch", 90, 5000],
    ["foil-highlights", 120, 7500], ["highlight-cap", 120, 4500],
    ["two-colors", 120, 8500], ["three-colors", 180, 9500], ["toner", 45, 1500],
  ] as const) {
    assert.equal(bySlug(slug).duration_minutes, duration);
    assert.equal(bySlug(slug).price_cents, price);
  }
  for (const s of data.variants.filter((s) => s.category === "PERMS")) assert.equal(s.duration_minutes, 120);
  assert.equal(data.variants.find((s) => s.slug === "pins-braids")!.duration_minutes, 60);
});
test("practice retries do not create more edits and manual owner changes are preserved", () => {
  const data = configured();
  assert.deepEqual(practiceCatalogPlan(data.services, data.variants), { updates: [], skipped: [] });
  const child = data.variants.find((s) => s.slug === "men")!;
  child.price_cents = 2500;
  child.price_approved = false;
  const plan = practiceCatalogPlan(data.services, data.variants);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(plan.skipped, ["adult-haircut/men"]);
  assert.equal(child.price_cents, 2500);
  assert.equal(child.price_approved, false);
  const original = catalog();
  original.services.find((s) => s.slug === "toner")!.cleanup_minutes = 10;
  assert.ok(practiceCatalogPlan(original.services, original.variants).skipped.includes("toner"));
});
test("practice planning refuses incomplete catalogs before any edits", () => {
  const data = catalog();
  assert.throws(() => practiceCatalogPlan(data.services, data.variants.filter((s) => s.slug !== "women")), /missing/);
});
test("catalog setup refuses hosted credentials before making an authentication request", async () => {
  await assert.rejects(configurePracticeCatalog({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }), /Refusing/);
});
