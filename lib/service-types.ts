export type Service = {
  id: string;
  salon_id: string;
  slug: string;
  category: string;
  name: string;
  description: string;
  pricing_type: "exact" | "starting" | "range" | "consultation";
  price_cents: number | null;
  price_max_cents: number | null;
  duration_minutes: number | null;
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
  price_approved: boolean;
  duration_approved: boolean;
  status: "draft" | "published" | "archived";
  active: boolean;
  length_qualification: string;
  display_order: number;
  preparation_minutes: number;
  cleanup_minutes: number;
  includes_cut_style: boolean;
  revision: number;
  service_id?: string;
  variants?: Service[];
  admin_notes?: string;
};
export type BookingOption = Service & {
  service_id: string;
  variant_id: string | null;
};
export const categories = [
  "CUTS",
  "WAXING",
  "COLOR",
  "PERMS",
  "EXTRAS",
] as const;
export function bookable(s: Service) {
  return (
    s.active &&
    s.status === "published" &&
    s.price_approved &&
    s.duration_approved &&
    s.price_cents !== null &&
    s.duration_minutes !== null &&
    ["exact", "starting"].includes(s.pricing_type) &&
    !s.variants?.some((v) => v.active && v.status === "published")
  );
}
const money = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(c / 100);
export function formatPrice(
  s: Pick<Service, "pricing_type" | "price_cents" | "price_max_cents">,
) {
  if (s.price_cents === null || s.pricing_type === "consultation")
    return "Price determined by salon";
  if (s.pricing_type === "range" && s.price_max_cents !== null)
    return `${money(s.price_cents)}–${money(s.price_max_cents)}`;
  return `${s.pricing_type === "starting" ? "From " : ""}${money(s.price_cents)}`;
}
export function formatDuration(
  s: Pick<
    Service,
    | "duration_minutes"
    | "duration_min_minutes"
    | "duration_max_minutes"
    | "duration_approved"
  >,
) {
  let label =
    s.duration_minutes !== null
      ? `${s.duration_minutes} min`
      : s.duration_min_minutes !== null && s.duration_max_minutes !== null
        ? `${s.duration_min_minutes}–${s.duration_max_minutes} min`
        : s.duration_max_minutes !== null
          ? `Up to ${s.duration_max_minutes} min`
          : "Duration to be confirmed";
  if (
    !s.duration_approved &&
    (s.duration_minutes !== null || s.duration_max_minutes !== null)
  )
    label += " (provisional)";
  return label;
}
export function bookingOptions(services: Service[]): BookingOption[] {
  return services.flatMap<BookingOption>((s) =>
    !s.active || s.status !== "published"
      ? []
      : s.variants?.length
        ? s.variants.filter(bookable).map((v) => ({
            ...v,
            name: `${s.name} — ${v.name}`,
            service_id: s.id,
            variant_id: v.id,
          }))
        : bookable(s)
          ? [{ ...s, service_id: s.id, variant_id: null }]
          : [],
  );
}
