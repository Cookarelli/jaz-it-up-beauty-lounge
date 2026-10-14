import { onlineBookingReady } from "@/lib/launch";
import { Intro } from "@/components/site";
import { BookingForm } from "@/components/booking-form";
import { catalog } from "@/lib/catalog";
import { bookingOptions } from "@/lib/service-types";
import { integrations } from "@/lib/integrations";
import { smsReady } from "@/lib/integration-config";
import { privilegedClient } from "@/lib/supabase";
import { env } from "@/lib/env";
export const metadata = {
  alternates: { canonical: "/book" },
  title: "Book an appointment",
};
export default async function Book({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; variant?: string }>;
}) {
  const selected = await searchParams;
  const { services, live } = await catalog();
  const options = bookingOptions(services);
  let allowSms = false;
  if (smsReady(integrations) && env.SUPABASE_SECRET_KEY) {
    const s = await privilegedClient()
      .from("communication_settings")
      .select("sms_enabled")
      .limit(1)
      .maybeSingle();
    allowSms = !s.error && s.data?.sms_enabled === true;
  }
  return (
    <section className="narrow">
      <Intro eyebrow="TIME JUST FOR YOU" title="Let’s book your visit.">
        Choose your service and a time that works for you. No account needed.
      </Intro>
      {live && onlineBookingReady && options.length > 0 ? (
        <BookingForm
          services={options}
          allowSms={allowSms}
          initialSelection={selected.variant || selected.service}
        />
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
