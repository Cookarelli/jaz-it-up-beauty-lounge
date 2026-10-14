import { configured } from "./env";
import { sessionClient } from "./supabase";
export type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category: string;
};
export const examples: Service[] = [
  {
    id: "cut",
    name: "Cut & finish",
    description: "A fresh shape, a beautiful finish, a little more you.",
    duration_minutes: 60,
    price_cents: 0,
    category: "The essentials",
  },
  {
    id: "color",
    name: "Color & dimension",
    description: "From a subtle refresh to your next signature shade.",
    duration_minutes: 120,
    price_cents: 0,
    category: "A little transformation",
  },
  {
    id: "style",
    name: "Styling & occasions",
    description: "Thoughtful styling for the moments that matter.",
    duration_minutes: 60,
    price_cents: 0,
    category: "Something special",
  },
];
export async function catalog() {
  if (!configured) return { services: examples, live: false };
  const db = await sessionClient();
  const { data, error } = await db
    .from("services")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw new Error("The service catalog is temporarily unavailable.");
  return { services: data as Service[], live: true };
}
