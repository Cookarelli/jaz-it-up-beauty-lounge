import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, copyFile, lstat, chmod, open, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  cleanEnvironment, localDockerHost, practiceContext, practiceEnvironment,
  practiceOrigin, practiceProject, verifyBindings,
} from "./practice-safety.mjs";

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = join(root, ".practice"), app = join(folder, "app");
const network = "jaz-practice-loopback";
let environment = cleanEnvironment();
const action = process.argv[2];
const exists = (path) => access(path).then(() => true, () => false);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const run = async (command, args, cwd = folder) =>
  (await exec(command, args, { cwd, env: environment, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
async function logged(command, args, name, cwd = folder, env = environment) {
  const log = await open(join(folder, name), "w", 0o600);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env, stdio: ["ignore", log.fd, log.fd] });
      child.once("error", () => reject(Error(`${command} could not start. See .practice/${name}.`)));
      child.once("exit", (code) => code === 0 ? resolve() : reject(Error(`${command} failed. See .practice/${name}; do not share credentials from logs.`)));
    });
  } finally { await log.close(); }
}
const cliArgs = (...args) => ["--yes", "--package=supabase@2.121.0", "--", "supabase", ...args];
async function connectDocker() {
  const context = JSON.parse(await run("docker", ["context", "inspect", practiceContext], root));
  environment.DOCKER_HOST = localDockerHost(context[0]);
  await run("docker", ["info", "--format", "{{.ServerVersion}}"], root);
}
async function ownedContainers() {
  const ids = await run("docker", ["ps", "-q", "--filter", `name=_${practiceProject}`]);
  return ids ? JSON.parse(await run("docker", ["inspect", ...ids.split(/\s+/)])) : [];
}
async function checkContainers() {
  try { verifyBindings(await ownedContainers()); }
  catch (error) {
    await logged("npx", cliArgs("stop"), "stop.log");
    throw error;
  }
}
async function ensureStack() {
  const known = await run("docker", ["network", "ls", "--format", "{{.Name}}"]);
  if (!known.split("\n").includes(network))
    await run("docker", ["network", "create", "--label", "jaz.practice=true", "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", network]);
  const details = JSON.parse(await run("docker", ["network", "inspect", network]))[0];
  if (details.Labels?.["jaz.practice"] !== "true" || details.Options?.["com.docker.network.bridge.host_binding_ipv4"] !== "127.0.0.1")
    throw Error("Practice network is not marked private; refusing to change it.");
  console.log("Starting the local database. The first run downloads free container images.");
  await logged("npx", cliArgs("start", "--network-id", network), "supabase-start.log");
  await checkContainers();
}
async function verifyWorkspace() {
  if (!(await exists(join(folder, "manifest.json"))))
    throw Error("Run npm run practice:setup first.");
  const manifest = await readJson(join(folder, "manifest.json"));
  const config = await readFile(join(folder, "supabase/config.toml"), "utf8");
  if (manifest.project !== practiceProject || !config.startsWith(`# Disposable local development only. Never link this stack to the salon project.\nproject_id = "${practiceProject}"`))
    throw Error("Refusing an unknown practice workspace.");
  if (await exists(join(folder, "supabase/.temp/project-ref")))
    throw Error("Practice must never be linked to a hosted Supabase project.");
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"])
    if (await exists(join(app, name))) throw Error("Remove the unexpected .env file from the practice app. It must use generated local credentials only.");
}
async function seedCustomers(config) {
  if (await exists(join(folder, "seeded.json"))) return;
  const db = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data: service, error } = await db.from("services").select("id").eq("name", "Eyebrow").single();
  if (error) throw Error("Practice catalog is unavailable.");
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 7);
  while (day.getUTCDay() !== 2) day.setUTCDate(day.getUTCDate() + 1);
  const date = day.toISOString().slice(0, 10);
  for (const [name, email, phone] of [
    ["Alex Sample", "alex.sample@example.invalid", "+15555550101"],
    ["Jamie Sample", "jamie.sample@example.invalid", "+15555550102"],
  ]) {
    const previous = await db.from("customers").select("id").eq("email", email);
    if (previous.error) throw Error("Practice customer lookup failed.");
    if (previous.data.length) continue;
    const slots = await db.rpc("available_slots", { p_service: service.id, p_date: date, p_variant: null });
    if (slots.error || !slots.data?.length) throw Error("No synthetic appointment slot is available.");
    const slot = slots.data[0];
    const booked = await db.rpc("begin_booking", {
      p_id: randomUUID(), p_token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      p_booking: { service_id: service.id, variant_id: null, stylist_id: slot.stylist_id, starts_at: slot.starts_at, name, email, phone, email_reminders_consent: false, sms_consent: false },
      p_fingerprint: null, p_livemode: false,
    });
    if (booked.error) throw Error("Could not create the synthetic appointment.");
  }
  await writeFile(join(folder, "seeded.json"), JSON.stringify({ date }), { mode: 0o600 });
}

try {
  if (!["setup", "start", "stop"].includes(action)) throw Error("Use npm run practice:setup, practice:start or practice:stop.");
  if (action === "setup") {
    await connectDocker();
    if (await exists(folder)) {
      await verifyWorkspace();
    } else {
      await mkdir(folder, { mode: 0o700 });
      // Copy tracked source, never .env files, cloud links, local caches or client data.
      const files = (await run("git", ["ls-files", "-z"], root)).split("\0").filter(Boolean);
      for (const file of files) {
        if (file.split("/").some((part) => part.startsWith(".env")) || file.startsWith(".vercel/")) continue;
        const source = join(root, file), destination = join(app, file);
        if (!(await lstat(source)).isFile()) throw Error("Practice source must contain regular files only.");
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(source, destination);
      }
      await mkdir(join(folder, "supabase/migrations"), { recursive: true });
      for (const file of files.filter((file) => file.startsWith("supabase/migrations/")))
        await copyFile(join(root, file), join(folder, file));
      const config = (await readFile(join(root, "supabase/config.toml"), "utf8")).replace('project_id = "jaz-isolated-e2e"', `project_id = "${practiceProject}"`);
      await writeFile(join(folder, "supabase/config.toml"), config);
      await writeFile(join(folder, "manifest.json"), JSON.stringify({ project: practiceProject, source: await run("git", ["rev-parse", "HEAD"], root) }), { mode: 0o600 });
    }
    await verifyWorkspace();
    console.log("Installing the isolated app's locked dependencies.");
    await logged("npm", ["ci", "--no-audit", "--no-fund"], "install.log", app);
    await ensureStack();
    const credentials = join(app, ".e2e/environment.json");
    if (!(await exists(credentials))) {
      await mkdir(join(app, ".e2e"), { recursive: true, mode: 0o700 });
      const status = await run("npx", cliArgs("status", "--output", "json"));
      await writeFile(join(app, ".e2e/status.json"), status, { mode: 0o600 });
      await logged(process.execPath, ["scripts/prepare-e2e.mjs"], "accounts.log", app);
    }
    const config = await readJson(credentials);
    practiceEnvironment(config); // Validate before any database write.
    await seedCustomers(config);
    const date = (await readJson(join(folder, "seeded.json"))).date;
    await writeFile(join(folder, "admin-login.txt"), `LOCAL PRACTICE ONLY — never use these details on the hosted site.\n\nAddress: ${practiceOrigin}/admin\nEmail: owner@example.invalid\nPassword: ${config.E2E_PASSWORD}\n\nFake appointments: Alex Sample and Jamie Sample, ${date}, Central Time.\nDo not enter real customers. No messages or payments are enabled.\n`, { mode: 0o600 });
    await chmod(join(folder, "admin-login.txt"), 0o600);
    console.log("Practice setup prepared. Start it with npm run practice:start.\nYour private login file is .practice/admin-login.txt. No password was printed.");
  } else {
    await verifyWorkspace();
    await connectDocker();
    if (action === "stop") {
      await logged("npx", cliArgs("stop"), "stop.log");
      console.log("Local database stopped; practice records preserved. Stop the app with Control-C in its Terminal.");
    } else {
      await ensureStack();
      const config = await readJson(join(app, ".e2e/environment.json"));
      const safeEnv = practiceEnvironment(config);
      console.log("Building the local practice app with messages and payments forced off.");
      await logged(process.execPath, ["node_modules/next/dist/bin/next", "build"], "build.log", app, safeEnv);
      console.log(`LOCAL PRACTICE ONLY\nBooking: ${practiceOrigin}/book\nDashboard: ${practiceOrigin}/admin\nLogin file: ${join(folder, "admin-login.txt")}\nUse fictional details only. Keep this Terminal open; press Control-C to stop.`);
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], { cwd: app, env: safeEnv, stdio: "inherit" });
        const stop = () => child.kill("SIGTERM");
        process.once("SIGINT", stop); process.once("SIGTERM", stop);
        child.once("error", reject);
        child.once("exit", (code, signal) => code === 0 || signal === "SIGTERM" ? resolve() : reject(Error("Practice app stopped unexpectedly.")));
      });
    }
  }
} catch (error) {
  // Child command error objects can contain status output with credentials.
  console.error(error?.code ? "Local prerequisite failed. Check that Colima's jaz-practice profile is running and Docker is installed." : error.message);
  process.exitCode = 1;
}
