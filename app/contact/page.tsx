import { Intro, Button } from "@/components/site";
export const metadata = { title: "Contact" };
export default function Contact() {
  return (
    <section>
      <Intro eyebrow="LET’S CONNECT" title="Make yourself at home.">
        We’re getting the finishing touches ready for your visit.
      </Intro>
      <div className="cards">
        <article className="card">
          <h2>Visit the lounge</h2>
          <p>
            Delia’s confirmed salon address, phone number, and opening hours
            will be published here before online booking opens.
          </p>
        </article>
        <article className="card">
          <h2>Plan a little time for you</h2>
          <p>Explore the service menu and check our booking availability.</p>
          <Button href="/book">Book your visit</Button>
        </article>
      </div>
    </section>
  );
}
