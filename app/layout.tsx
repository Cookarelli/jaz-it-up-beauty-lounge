import { canIndex } from "@/lib/launch";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/site";
import { env } from "@/lib/env";
import "./globals.css";
export const metadata: Metadata = {
  robots: { index: canIndex, follow: canIndex },
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Jaz It Up Beauty Lounge | A little time for you",
    template: "%s | Jaz It Up Beauty Lounge",
  },
  description:
    "Discover thoughtful cuts, color and styling at Delia’s Jaz It Up Beauty Lounge. Explore services and book your next visit.",
  openGraph: {
    title: "Jaz It Up Beauty Lounge",
    description: "A little time for you. A look you love.",
    type: "website",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
