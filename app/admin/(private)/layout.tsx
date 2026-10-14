export const dynamic = "force-dynamic";
import { adminClient } from "@/lib/supabase";
import { configured } from "@/lib/env";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "../login/actions";
export const metadata = {
  title: "Salon management",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured) redirect("/admin/login");
  const db = await adminClient();
  if (!db) redirect("/admin/login?error=1");
  return (
    <section>
      <span className="eyebrow">JAZ IT UP · SALON MANAGEMENT</span>
      <h1>Your lounge, at a glance.</h1>
      <nav className="admin-nav" aria-label="Salon management">
        <Link href="/admin">Appointments</Link>
        <Link href="/admin/services">Service catalog</Link>
        <Link href="/admin/availability">Availability</Link>
        <form action={logout}>
          <button>Sign out</button>
        </form>
      </nav>
      {children}
    </section>
  );
}
