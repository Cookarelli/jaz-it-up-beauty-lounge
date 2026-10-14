import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
export class RequestProblem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function boundedText(req: Request, limit = 8192) {
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new RequestProblem(413, "Request too large.");
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestProblem(413, "Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function boundedJson(
  req: Request,
  limit = 8192,
): Promise<unknown> {
  if (
    req.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
  )
    throw new RequestProblem(415, "Send JSON content.");
  const text = await boundedText(req, limit);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestProblem(400, "Invalid JSON.");
  }
}
// Trust only Vercel's platform-provided header, never a caller-selected IP header.
// Local development uses a single shared bucket, even if forged forwarding headers are supplied.
export function rateKey(req: Request, secret: string, onVercel: boolean) {
  const host = new URL(req.url).hostname;
  const ip = onVercel
    ? req.headers.get("x-vercel-forwarded-for")?.trim()
    : ["localhost", "127.0.0.1", "[::1]"].includes(host)
      ? "127.0.0.1"
      : null;
  if (!ip || !isIP(ip))
    throw new RequestProblem(503, "Request source could not be verified.");
  // Canonicalize equivalent IPv6 spellings before hashing.
  let identity = ip;
  if (isIP(ip) === 6) {
    const canonical = new URL(`http://[${ip}]`).hostname.slice(1, -1);
    identity = canonical;
  }
  return createHmac("sha256", secret).update(identity).digest("hex");
}
export function logServerFailure(event: string, code?: unknown) {
  const reference = randomUUID();
  console.error(
    JSON.stringify({
      event,
      reference,
      ...(typeof code === "string" && /^[A-Z0-9_]{2,12}$/.test(code)
        ? { code }
        : {}),
    }),
  );
  return reference;
}
