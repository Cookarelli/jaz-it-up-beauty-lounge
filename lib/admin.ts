import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminClient } from "./supabase";
export const adminContext = cache(async () => {
  const db = await adminClient();
  if (!db) redirect("/admin/login");
  const { data, error } = await db
    .from("salons")
    .select("id,name,timezone")
    .order("created_at")
    .limit(1)
    .single();
  if (error || !data) throw Error("Your salon access could not be loaded.");
  return { db, salon: data as { id: string; name: string; timezone: string } };
});
export type Appointment = {
  id: string;
  service_id: string;
  customer_id: string | null;
  stylist_id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  email: string | null;
  phone: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  price_cents: number;
  notes: string;
  source: string;
  revision: number;
  service_snapshot: { name?: string; includes_cut_style?: boolean };
  services: { name: string; salon_id: string };
  stylists: { name: string };
};
export const appointmentFields =
  "*,services!inner(name,salon_id),stylists(name)";
export function appointmentTitle(a: Appointment) {
  return a.service_snapshot.name || a.services.name;
}
