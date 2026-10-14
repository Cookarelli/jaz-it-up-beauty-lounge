import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const config = JSON.parse(readFileSync(".e2e/environment.json", "utf8"));
if (
  config.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321" ||
  config.NEXT_PUBLIC_SITE_URL !== "http://127.0.0.1:3100"
)
  throw Error("Refusing non-local E2E server");
if (
  config.PUBLIC_BOOKING_ENABLED !== "true" ||
  !config.BOOKING_RATE_LIMIT_SECRET ||
  !config.SUPABASE_SECRET_KEY
)
  throw Error("Incomplete local booking configuration");
const env = { ...process.env, ...config, NEXT_TELEMETRY_DISABLED: "1" };
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", ...args],
      { env, stdio: "inherit" },
    );
    const stop = () => child.kill("SIGTERM");
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);
      if (code === 0) resolve();
      else reject(Error(`E2E server exited (${code})`));
    });
  });
}
await run(["build"]);
await run(["start", "--hostname", "127.0.0.1", "--port", "3100"]);
