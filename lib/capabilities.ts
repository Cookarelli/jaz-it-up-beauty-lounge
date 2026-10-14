import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function secureEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function preferenceToken(id: string, expires: number, secret: string) {
  const value = `${id}.${expires}`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}
export function verifyPreference(
  token: string,
  secret: string,
  now = Date.now(),
) {
  const [id, expires] = token.split(".");
  if (
    !/^[a-f0-9-]{36}$/.test(id || "") ||
    !/^\d+$/.test(expires || "") ||
    Number(expires) * 1000 < now
  )
    return null;
  return secureEqual(token, preferenceToken(id, Number(expires), secret))
    ? id
    : null;
}
