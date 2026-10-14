export const dynamic = "force-dynamic";
import { adminContext } from "@/lib/admin";
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
  const { salon } = await adminContext();
  return (
    <section className="admin-shell">
      <div className="admin-brand">
        <div>
          <span className="eyebrow">PRIVATE SALON MANAGEMENT</span>
          <h1>{salon.name}</h1>
          <p>All times in {salon.timezone}.</p>
        </div>
        <form action={logout}>
          <button className="secondary">Sign out</button>
        </form>
      </div>
      <nav className="admin-nav" aria-label="Salon management">
        {[
          ["Today", "/admin"],
          ["Calendar", "/admin/calendar"],
          ["Bookings", "/admin/appointments"],
          ["Customers", "/admin/customers"],
          ["Hours & time off", "/admin/availability"],
          ["Services", "/admin/services"],
          ["Salon & policies", "/admin/settings"],
          ["Reports", "/admin/reports"],
          ["Change history", "/admin/history"],
        ].map(([label, url]) => (
          <Link key={url} href={url}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="admin-content">{children}</div>
    </section>
  );
}
