import { createClient } from "@supabase/supabase-js";
import menu from "../data/service-menu.json" with { type: "json" };
import { practiceEnvironment } from "./practice-safety.mjs";

// Project-owner-approved practice timings, 2026-10-15. Never a live migration.
// Starting prices retain the board minimum. Design work uses an explicit $10
// fictional estimate because the salon has not supplied a price.
const adjustments = {
  "kids-haircut": { duration_minutes: 30, pricing_type: "starting" },
  "beard-mustache": { duration_minutes: 15, pricing_type: "starting" },
  "extra-design": { duration_minutes: 30, pricing_type: "starting", price_cents: 1000 },
  retouch: { duration_minutes: 90 },
  "foil-highlights": { duration_minutes: 120 },
  "highlight-cap": { duration_minutes: 120 },
  "two-colors": { duration_minutes: 120 },
  "three-colors": { duration_minutes: 180 },
  toner: { duration_minutes: 45 },
  "adult-haircut/men": { pricing_type: "starting" },
  "adult-haircut/women": { pricing_type: "starting" },
  "occasion-style/pins-braids": { duration_minutes: 60 },
};
for (const parent of ["top-only-perm", "regular-perm", "spiral-perm"])
  for (const length of ["above_shoulder", "shoulder", "below_shoulder"])
    adjustments[`${parent}/${length}`] = { duration_minutes: 120 };

// Exact allowlist accepted by the existing, authenticated admin RPC.
const fields = [
  "name", "description", "category", "active", "pricing_type", "price_cents",
  "price_max_cents", "duration_minutes", "duration_min_minutes", "duration_max_minutes",
  "price_approved", "duration_approved", "status", "length_qualification",
  "display_order", "preparation_minutes", "cleanup_minutes", "admin_notes",
];
const pick = (entry) => Object.fromEntries(fields.map((field) => [field, entry[field]]));
const matches = (entry, expected) => fields.every((field) => entry[field] === expected[field]);

export function practiceCatalogPlan(services, variants) {
  const updates = [], skipped = [];
  for (const [key, adjustment] of Object.entries(adjustments)) {
    const [parentSlug, variantSlug] = key.split("/");
    const parent = services.find((s) => s.slug === parentSlug);
    const original = variantSlug
      ? menu.variants.find((s) => s.parent_slug === parentSlug && s.slug === variantSlug)
      : menu.services.find((s) => s.slug === parentSlug);
    const entry = variantSlug
      ? variants.find((s) => s.service_id === parent?.id && s.slug === variantSlug)
      : parent;
    if (!entry || !original) throw Error(`Practice catalog entry is missing: ${key}`);
    const baseline = { ...original, active: true };
    const desired = pick({
      ...baseline, ...adjustment,
      name: `${original.name} (practice)`,
      description: `Local practice only: provisional price/timing. Delia must approve before launch. ${original.description}`,
      admin_notes: `LOCAL PRACTICE ONLY. Project owner accepted temporary practice configuration on 2026-10-15. Not Delia's launch approval. ${original.admin_notes}`,
      price_max_cents: null,
      duration_min_minutes: null,
      duration_max_minutes: null,
      price_approved: true,
      duration_approved: true,
    });
    if (matches(entry, desired)) continue; // Retry-safe, without duplicate audit edits.
    if (!matches(entry, baseline)) {
      skipped.push(key); // Preserve every subsequent manual edit, even a disabled service.
      continue;
    }
    updates.push({ key, kind: variantSlug ? "variant" : "service", id: entry.id, revision: entry.revision, values: desired });
  }
  return { updates, skipped };
}

export async function configurePracticeCatalog(config) {
  const safe = practiceEnvironment(config); // Refuse hosted/lookalike origins before login.
  const db = createClient(safe.NEXT_PUBLIC_SUPABASE_URL, safe.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({ email: "owner@example.invalid", password: config.E2E_PASSWORD });
  if (login.error) throw Error("Could not sign in to the local practice owner account.");
  try {
    const role = await db.from("staff_roles").select("salon_id").eq("user_id", login.data.user.id).eq("role", "owner");
    if (role.error || role.data?.length !== 1) throw Error("A single local owner salon is required.");
    const salon = role.data[0].salon_id;
    const [services, variants] = await Promise.all([
      db.from("services").select("*").eq("salon_id", salon),
      db.from("service_variants").select("*").eq("salon_id", salon),
    ]);
    if (services.error || variants.error) throw Error("Local practice catalog could not be read.");
    const plan = practiceCatalogPlan(services.data, variants.data);
    for (const entry of plan.updates) {
      const result = await db.rpc("edit_catalog_entry", { p_kind: entry.kind, p_id: entry.id, p_revision: entry.revision, p_values: entry.values });
      if (result.error) throw Error(`Practice edit failed for ${entry.key}. Refresh before retrying; completed edits are preserved.`);
    }
    return { updated: plan.updates.length, skipped: plan.skipped };
  } finally {
    await db.auth.signOut({ scope: "local" });
  }
}
