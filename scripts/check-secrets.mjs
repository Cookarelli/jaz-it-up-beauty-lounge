import { execFileSync } from "node:child_process";
const rows = execFileSync("git", ["rev-list", "--objects", "--all"], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
const findings = [];
let checked = 0;
for (const row of rows) {
  const [sha, ...rest] = row.split(" ");
  const path = rest.join(" ");
  if (
    !path ||
    execFileSync("git", ["cat-file", "-t", sha], {
      encoding: "utf8",
    }).trim() !== "blob"
  )
    continue;
  const content = execFileSync("git", ["cat-file", "blob", sha], {
    maxBuffer: 5 * 1024 * 1024,
  }).toString();
  checked++;
  const key =
    /(?:sk_(?:live|test)_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
      content,
    );
  const roleToken = [
    ...content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g),
  ].some((m) => {
    try {
      return (
        JSON.parse(Buffer.from(m[1], "base64url").toString()).role ===
        "service_role"
      );
    } catch {
      return false;
    }
  });
  if (key || roleToken) findings.push(path);
}
if (findings.length) {
  console.error("Potential credentials in tracked history:", [
    ...new Set(findings),
  ]);
  process.exitCode = 1;
} else
  console.log(
    `PASS: scanned ${checked} Git blobs for private keys, Stripe/Supabase secret patterns and service-role JWTs. Public publishable keys and synthetic fixtures are not secrets. Pattern scan is not proof against every possible credential format.`,
  );
