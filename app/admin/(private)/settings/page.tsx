import Link from "next/link";
import { adminContext } from "@/lib/admin";
import { AdminForm, Field, Notes } from "@/components/admin-form";
import { saveProfile, savePolicy } from "../management-actions";
export default async function Settings() {
  const { db, salon } = await adminContext();
  const [profile, policy] = await Promise.all([
    db.from("salon_profiles").select("*").eq("salon_id", salon.id).single(),
    db.from("booking_policies").select("*").eq("salon_id", salon.id).single(),
  ]);
  if (profile.error || policy.error) throw Error("Settings unavailable.");
  const s = profile.data,
    p = policy.data;
  return (
    <>
      <h2>Salon website & booking policies</h2>
      <div className="admin-columns">
        <article className="card">
          <h3>Public salon information</h3>
          <p>
            Changes appear on the homepage and Contact page.{" "}
            <Link href="/admin/availability">Edit business hours →</Link>
          </p>
          <AdminForm
            action={saveProfile}
            key={s.revision}
            confirm="Publish these salon contact details and homepage content?"
          >
            <input type="hidden" name="revision" value={s.revision} />
            <Field
              name="phone"
              label="Salon phone"
              value={s.phone}
              type="tel"
            />
            <Field
              name="email"
              label="Salon email"
              value={s.email}
              type="email"
            />
            <Notes
              name="address"
              label="Street address"
              value={s.address}
              max={500}
            />
            <Field
              name="instagram_url"
              label="Instagram HTTPS link"
              value={s.instagram_url}
              type="url"
            />
            <Field
              name="facebook_url"
              label="Facebook HTTPS link"
              value={s.facebook_url}
              type="url"
            />
            <Field
              name="hero_title"
              label="Homepage headline"
              value={s.hero_title}
              required
            />
            <Notes
              name="hero_text"
              label="Homepage introduction"
              value={s.hero_text}
              max={1000}
            />
            <Notes
              name="about_text"
              label="About the salon"
              value={s.about_text}
            />
          </AdminForm>
        </article>
        <article className="card">
          <h3>Booking & cancellation policy</h3>
          <AdminForm
            key={p.revision}
            action={savePolicy}
            confirm="Save these booking and cancellation policies?"
          >
            <input type="hidden" name="revision" value={p.revision} />
            <Field
              name="minimum_notice_minutes"
              label="Minimum online booking notice (minutes)"
              type="number"
              value={p.minimum_notice_minutes}
              min={0}
              max={10080}
              required
            />
            <Field
              name="maximum_advance_days"
              label="Online booking horizon (days)"
              type="number"
              value={p.maximum_advance_days}
              min={1}
              max={365}
              required
            />
            <Field
              name="slot_interval_minutes"
              label="Start-time spacing (minutes)"
              type="number"
              value={p.slot_interval_minutes}
              min={5}
              max={120}
              required
            />
            <Field
              name="cancellation_notice_hours"
              label="Cancellation notice (hours; optional)"
              type="number"
              value={p.cancellation_notice_hours}
              min={0}
              max={8760}
            />
            <Notes
              name="cancellation_text"
              label="Cancellation policy wording"
              value={p.cancellation_text}
              max={3000}
            />
            <input type="hidden" name="deposit_type" value={p.deposit_type} />
            <input
              type="hidden"
              name="deposit_value"
              value={p.deposit_value ?? ""}
            />
            <p>
              <Link href="/admin/payments">
                Manage optional deposits and refund terms →
              </Link>
            </p>
          </AdminForm>
        </article>
      </div>
    </>
  );
}
