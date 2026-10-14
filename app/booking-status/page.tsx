import { BookingStatus } from "@/components/booking-status";
export const metadata = {
  title: "Booking status",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <section className="narrow">
      <h1>Your booking status</h1>
      {id && /^[a-f0-9-]{36}$/.test(id) ? (
        <BookingStatus id={id} />
      ) : (
        <p>Use the booking-status link from your checkout.</p>
      )}
    </section>
  );
}
