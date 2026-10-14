import { Intro } from "@/components/site";
import { BookingForm } from "@/components/booking-form";
import { catalog } from "@/lib/catalog";
import { env } from "@/lib/env";
export const metadata = { title: "Book an appointment" };
export default async function Book() {
  const { services, live } = await catalog();
  return (
    <section className="narrow">
      <Intro eyebrow="TIME JUST FOR YOU" title="Let’s book your visit.">
        Choose your service and a time that works for you. No account needed.
      </Intro>
      {live && env.SUPABASE_SECRET_KEY ? (
        <BookingForm services={services} />
      ) : (
        <div className="notice">
          <h2>Online booking is coming soon</h2>
          <p>
            Delia is preparing the service menu and appointment calendar. No
            appointment can be reserved yet. Please check back soon.
          </p>
        </div>
      )}
    </section>
  );
}
