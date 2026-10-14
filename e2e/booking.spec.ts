import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localDate, localToISO, shiftDay } from "../lib/admin-time";
const config = JSON.parse(readFileSync(".e2e/environment.json", "utf8"));
if (config.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Tests refuse a hosted database");
const db = createClient(
  config.NEXT_PUBLIC_SUPABASE_URL,
  config.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const origin = "http://127.0.0.1:3100";
let day = shiftDay(localDate(), 7);
while (new Date(day + "T12:00Z").getUTCDay() !== 2) day = shiftDay(day, 1);
async function login(page: Page, email = "owner@example.invalid") {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(config.E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async () => {
  // Each test uses the real shared limiter. Clear only this disposable runner's prior counters.
  const result = await db.from("api_rate_limits").delete().neq("scope", "");
  expect(result.error).toBeNull();
});
test("guest booking → saved receipt → owner reschedule/cancel; retries and conflict protection", async ({
  page,
  request,
}) => {
  await page.goto("/services");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await fits(page);
  await page.goto("/book");
  await page
    .getByLabel("Service", { exact: true })
    .selectOption({ label: "Eyebrow · $10.00" });
  await expect(page.getByLabel("Selected service")).toContainText("15 minutes");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByLabel("Preferred date").fill(day);
  await page.getByRole("button", { name: "Find available times" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Choose an available time.",
  );
  await page
    .getByLabel("Time (Central Time)", { exact: true })
    .selectOption("0");
  await page.getByLabel("Your name").fill("Synthetic Guest");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`guest-${randomUUID()}@example.invalid`);
  await page.getByLabel("Phone", { exact: true }).fill("+15555550101");
  await fits(page);
  const reservation = page.waitForResponse(
    (r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Reserve appointment" }).click();
  const response = await reservation;
  expect(response.status()).toBe(201);
  const body = await response.json();
  const submitted = response.request().postDataJSON();
  await expect(page).toHaveURL(
    new RegExp(`/booking-status\\?id=${body.request_id}`),
  );
  await expect(
    page.getByRole("heading", { name: "Your appointment is confirmed" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your visit")).toContainText("Eyebrow");
  await expect(page.getByLabel("Your visit")).toContainText("15 minutes");
  await expect(page.getByText("Booking reference:")).toContainText(
    body.reference,
  );
  await fits(page);
  const saved = await db
    .from("appointments")
    .select(
      "starts_at,ends_at,status,price_cents,email_reminders_consent,sms_consent",
    )
    .eq("id", body.reference)
    .single();
  expect(saved.error).toBeNull();
  expect(saved.data?.status).toBe("confirmed");
  expect(saved.data?.price_cents).toBe(1000);
  expect(saved.data?.email_reminders_consent).toBe(false);
  expect(saved.data?.sms_consent).toBe(false);
  expect(
    Date.parse(saved.data!.ends_at) - Date.parse(saved.data!.starts_at),
  ).toBe(15 * 60_000);
  const retry = await request.post("/api/bookings", {
    headers: { origin },
    data: submitted,
  });
  expect(retry.status()).toBe(201);
  expect((await retry.json()).reference).toBe(body.reference);
  const conflict = await request.post("/api/bookings", {
    headers: { origin },
    data: {
      ...submitted,
      request_id: randomUUID(),
      access_token: randomBytes(32).toString("hex"),
      email: `conflict-${randomUUID()}@example.invalid`,
    },
  });
  expect(conflict.status()).toBe(409);
  const denied = await request.post("/api/booking-status", {
    data: { id: body.request_id, token: randomBytes(32).toString("hex") },
  });
  expect(denied.status()).toBe(404);
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/appointments/${body.reference}`);
  await expect(
    page.getByRole("heading", { name: "Synthetic Guest" }),
  ).toBeVisible();
  await fits(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Start (America/Chicago)").fill(`${day}T12:30`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("appointments")
            .select("starts_at")
            .eq("id", body.reference)
            .single()
        ).data?.starts_at,
    )
    .toBe(
      localToISO(`${day}T12:30`, "America/Chicago").replace(".000Z", "+00:00"),
    );
  await page.reload();
  await page.getByLabel("Status", { exact: true }).selectOption("cancelled");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("appointments")
            .select("status")
            .eq("id", body.reference)
            .single()
        ).data?.status,
    )
    .toBe("cancelled");
  const status = await request.post("/api/booking-status", {
    data: { id: body.request_id, token: submitted.access_token },
  });
  const updated = await status.json();
  expect(updated.status).toBe("cancelled");
  expect(updated.appointment.service).toBe("Eyebrow");
  expect(updated.appointment.timezone).toBe("America/Chicago");
  expect(updated.appointment).not.toHaveProperty("notes");
  const slots = await request.get(
    `/api/availability?service=${submitted.service_id}&date=${day}`,
  );
  expect(
    (await slots.json()).slots.some(
      (s: { starts_at: string }) =>
        Date.parse(s.starts_at) === Date.parse(submitted.starts_at),
    ),
  ).toBe(true);
  const sent = await db
    .from("notification_jobs")
    .select("id", { count: "exact", head: true })
    .not("sent_at", "is", null);
  expect(sent.error).toBeNull();
  expect(sent.count).toBe(0);
});
test("private pages deny guests and ordinary authenticated users", async ({
  page,
}) => {
  await page.goto("/admin/customers");
  await expect(page).toHaveURL(/\/admin\/login/);
  await login(page, "outsider@example.invalid");
  await expect(page).toHaveURL(/\/admin\/login\?error=1/);
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toHaveCount(0);
  const outsider = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  expect(
    (
      await outsider.auth.signInWithPassword({
        email: "outsider@example.invalid",
        password: config.E2E_PASSWORD,
      })
    ).error,
  ).toBeNull();
  const read = await outsider.from("customers").select("id");
  expect(read.data || []).toHaveLength(0);
  const write = await outsider
    .from("customers")
    .insert({ name: "Unauthorized" });
  expect(write.error).not.toBeNull();
  await outsider.auth.signOut();
});
test("owner calendar and hours forms work; manual time off removes slots", async ({
  page,
  request,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/calendar?date=${day}&view=week`);
  await expect(page.getByRole("list", { name: "week calendar" })).toBeVisible();
  await expect(page.getByText("Salon closed", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText("Salon hours: 9:00 AM–7:00 PM", { exact: true }),
  ).toHaveCount(4);
  await expect(
    page.getByText("Salon hours: 9:00 AM–3:00 PM", { exact: true }),
  ).toHaveCount(1);
  await fits(page);
  await page.getByLabel("View", { exact: true }).selectOption("month");
  await page.getByRole("button", { name: "View calendar" }).click();
  await expect(
    page.getByRole("list", { name: "month calendar" }),
  ).toBeVisible();
  await fits(page);
  await page.goto("/admin/availability");
  const business = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Public business hours",
        exact: true,
      }),
    });
  await expect(business.getByLabel("Opens", { exact: true })).toHaveValue(
    "09:00",
  );
  await expect(business.getByLabel("Closes", { exact: true })).toHaveValue(
    "19:00",
  );
  await business.getByLabel("Day of week").selectOption("6");
  await expect(business.getByLabel("Closes", { exact: true })).toHaveValue(
    "15:00",
  );
  page.on("dialog", (dialog) => dialog.accept());
  await business.getByLabel("Closes", { exact: true }).fill("14:30");
  await business.getByRole("button", { name: "Save business day" }).click();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("business_hours")
            .select("closes_at")
            .eq("weekday", 6)
            .single()
        ).data?.closes_at,
    )
    .toBe("14:30:00");
  await business.getByLabel("Closes", { exact: true }).fill("15:00");
  await business.getByRole("button", { name: "Save business day" }).click();
  await expect
    .poll(
      async () =>
        (
          await db
            .from("business_hours")
            .select("closes_at")
            .eq("weekday", 6)
            .single()
        ).data?.closes_at,
    )
    .toBe("15:00:00");
  const block = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Block time off", exact: true }),
    });
  await block.getByLabel("From", { exact: true }).fill(`${day}T10:00`);
  await block.getByLabel("Until", { exact: true }).fill(`${day}T11:00`);
  await block.getByLabel("Reason (private)").fill("Synthetic test time off");
  await block.getByRole("button", { name: "Block time", exact: true }).click();
  await expect(
    page.getByText("Synthetic test time off", { exact: true }),
  ).toBeVisible();
  const service = await db
    .from("services")
    .select("id")
    .eq("name", "Eyebrow")
    .single();
  const response = await request.get(
    `/api/availability?service=${service.data!.id}&date=${day}`,
  );
  const slots = (await response.json()).slots as { starts_at: string }[];
  const start = Date.parse(localToISO(`${day}T10:00`, "America/Chicago"));
  expect(
    slots.some(
      (s) =>
        Date.parse(s.starts_at) >= start &&
        Date.parse(s.starts_at) < start + 3600000,
    ),
  ).toBe(false);
  const exception = page
    .getByRole("article")
    .filter({
      has: page.getByText("Synthetic test time off", { exact: true }),
    });
  await exception.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByText("No upcoming time off or closures."),
  ).toBeVisible();
  await fits(page);
});
