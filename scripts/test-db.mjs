import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw Error(
    "Set TEST_DATABASE_URL to a disposable PostgreSQL test database. No production credentials are needed.",
  );
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const existing = await db.query(
    "select to_regclass('public.services') as services",
  );
  if (!existing.rows[0].services) {
    // Minimal Supabase auth compatibility for an isolated PostgreSQL CI container.
    await db.query(
      `create schema if not exists auth; create table if not exists auth.users(id uuid primary key,email text); do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end $$; create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.query(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  for (const file of (await readdir("supabase/tests"))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    const result = await db.query(
      await readFile(`supabase/tests/${file}`, "utf8"),
    );
    console.log(file, result.at(-1)?.rows || "Database tests passed.");
  }
} finally {
  await db.query("rollback").catch(() => {});
  await db.end();
}
