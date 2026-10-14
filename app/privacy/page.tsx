import { Intro } from "@/components/site";
export const metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy",
};
export default function Privacy() {
  return (
    <section className="narrow">
      <Intro eyebrow="YOUR INFORMATION" title="Privacy, with care">
        We collect only what we need to arrange your visit.
      </Intro>
      <p>
        Booking collects your name, email, phone number, selected service, and
        appointment time. Salon staff use this information to manage
        appointments and send service-related confirmations and changes. Email
        reminders and texts require your optional consent. You can stop
        appointment emails using their preference link, and stop texts by
        replying STOP. Opting out does not cancel your appointment. No customer
        account is required. Please do not submit medical or other sensitive
        information.
      </p>
      <p>
        Appointment data is stored in Supabase and processed by the configured
        transactional email provider (Resend) and, only if enabled, SMS provider
        (Twilio). We record consent, opt-outs and delivery attempts. Optional
        deposits use Stripe-hosted Checkout; the salon stores payment references
        and amounts, never card details. We do not sell booking information.
        Contact the salon to request correction or deletion. Delia must publish
        a contact method, retention period, and final provider disclosures
        before launch.
      </p>
    </section>
  );
}
