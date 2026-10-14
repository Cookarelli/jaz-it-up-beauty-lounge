import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { testDatabaseUrl } from "./test-database-url.mjs";
// This suite commits synthetic fixtures so independent connections can race.
// Run only on disposable CI/local databases; discard the database after the run.
const pool = new pg.Pool({
  connectionString: testDatabaseUrl(),
  max: 16,
  statement_timeout: 15000,
});
const salon = randomUUID(),
  stylist = randomUUID(),
  service = randomUUID();
try {
  await pool.query(
    "insert into public.salons(id,name) values($1,'Concurrency fixture')",
    [salon],
  );
  await pool.query(
    "insert into public.locations(id,salon_id,name) values($1,$1,'Concurrency fixture')",
    [salon],
  );
  await pool.query(
    "insert into public.stylists(id,location_id,name) values($1,$2,'Fixture stylist')",
    [stylist, salon],
  );
  await pool.query(
    "insert into public.staff(salon_id,stylist_id,name) values($1,$2,'Fixture stylist')",
    [salon, stylist],
  );
  await pool.query(
    "insert into public.booking_policies(salon_id,minimum_notice_minutes) values($1,0)",
    [salon],
  );
  await pool.query(
    "insert into public.communication_settings(salon_id,email_enabled) values($1,true)",
    [salon],
  );
  await pool.query(
    "insert into public.services(id,salon_id,slug,name,category,price_cents,duration_minutes,cleanup_minutes,price_approved,duration_approved,status) values($1,$2,'race-fixture','Race fixture','EXTRAS',2000,30,15,true,true,'published')",
    [service, salon],
  );
  const day = (await pool.query("select (current_date+10)::text as day"))
    .rows[0].day;
  const at = async (hour) =>
    (
      await pool.query(
        "select ($1::date+$2::time) at time zone 'America/Chicago' as t",
        [day, `${hour}:00`],
      )
    ).rows[0].t.toISOString();
  await pool.query(
    "insert into public.availability(stylist_id,starts_at,ends_at) values($1,$2,$3)",
    [stylist, await at("09:00"), await at("19:00")],
  );
  const book = (
    start,
    id = randomUUID(),
    email = `${randomUUID()}@example.invalid`,
  ) =>
    pool.query("select (public.begin_booking($1,$2,$3::jsonb)).*", [
      id,
      "a".repeat(64),
      JSON.stringify({
        service_id: service,
        variant_id: null,
        stylist_id: stylist,
        starts_at: start,
        name: "Race fixture",
        email,
        phone: "+15550000001",
        email_reminders_consent: false,
        sms_consent: false,
      }),
    ]);
  const start = await at("10:00");
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => book(start)),
  );
  assert.equal(
    results.filter((x) => x.status === "fulfilled").length,
    1,
    "Exactly one overlapping public booking commits",
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from public.appointments where stylist_id=$1",
        [stylist],
      )
    ).rows[0].n,
    1,
  );
  for (const r of results.filter((x) => x.status === "rejected"))
    assert.match(r.reason.message, /Unavailable|conflict/i);
  console.log("PASS: twelve concurrent bookings, one confirmed appointment");

  const retryId = randomUUID(),
    retryStart = await at("11:00"),
    email = `${randomUUID()}@example.invalid`;
  const retried = await Promise.all(
    Array.from({ length: 8 }, () => book(retryStart, retryId, email)),
  );
  assert.equal(new Set(retried.map((x) => x.rows[0].appointment_id)).size, 1);
  console.log(
    "PASS: eight concurrent identical retries return one appointment",
  );

  const buffered = await Promise.allSettled([
    book(await at("12:00")),
    book(await at("12:30")),
  ]);
  assert.equal(
    buffered.filter((x) => x.status === "fulfilled").length,
    1,
    "Buffers prevent concurrent adjacent overlaps",
  );
  console.log("PASS: buffer-only conflict prevents the second booking");

  const holdStart = await at("14:00");
  const holdRace = await Promise.allSettled([
    pool.query("select public.create_appointment_hold($1,$2,$3)", [
      service,
      stylist,
      holdStart,
    ]),
    book(holdStart),
  ]);
  assert.equal(
    holdRace.filter((x) => x.status === "fulfilled").length,
    1,
    "A booking cannot steal a concurrent hold",
  );
  console.log("PASS: appointment hold versus reservation has one winner");

  const blockRace = await Promise.allSettled([
    pool.query(
      "insert into public.time_blocks(salon_id,stylist_id,starts_at,ends_at,note) values($1,$2,$3,$4,'Fixture closure')",
      [salon, stylist, await at("15:50"), await at("16:45")],
    ),
    book(await at("16:00")),
  ]);
  assert.equal(
    blockRace.filter((x) => x.status === "fulfilled").length,
    1,
    "Manual time off and booking serialize",
  );
  console.log(
    "PASS: manual time off versus booking preserves one valid schedule",
  );

  const pending = (
    await pool.query(
      "select count(*)::int n from public.notification_jobs where state='pending' and due_at<=now()",
    )
  ).rows[0].n;
  assert.ok(pending > 0);
  const claims = await Promise.all([
    pool.query("select id from public.claim_messages('email')"),
    pool.query("select id from public.claim_messages('email')"),
  ]);
  const ids = claims.flatMap((x) => x.rows.map((r) => r.id));
  assert.equal(ids.length, pending);
  assert.equal(new Set(ids).size, pending);
  console.log(
    "PASS: concurrent workers claim each notification once; no provider called",
  );

  const key = randomBytes(32).toString("hex");
  const limits = await Promise.all(
    Array.from({ length: 20 }, () =>
      pool.query("select public.consume_api_limit('bookings',$1) allowed", [
        key,
      ]),
    ),
  );
  assert.equal(limits.filter((r) => r.rows[0].allowed).length, 5);
  console.log("PASS: twenty concurrent limiter requests admit exactly five");
} finally {
  await pool.end();
}
