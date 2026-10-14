import { env } from "@/lib/env";
export default function sitemap() {
  return ["", "/services", "/book", "/gallery", "/contact", "/privacy"].map(
    (path) => ({ url: env.NEXT_PUBLIC_SITE_URL + path }),
  );
}
