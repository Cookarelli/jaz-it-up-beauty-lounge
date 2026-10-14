import { canIndex } from "@/lib/launch";
import { env } from "@/lib/env";
export default function robots() {
  return {
    rules: canIndex
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin", "/api/", "/booking-status", "/preferences"],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
