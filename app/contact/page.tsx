import { Intro, Button } from "@/components/site";
import { publicProfile } from "@/lib/salon-profile";
import { weekdays } from "@/lib/admin-time";
export const dynamic = "force-dynamic";
export const metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact",
};
export default async function Contact() {
  const s = await publicProfile();
  return (
    <section>
      <Intro eyebrow="LET’S CONNECT" title="Make yourself at home.">
        Plan a visit to Jaz It Up Beauty Lounge.
      </Intro>
      <div className="cards">
        <article className="card">
          <h2>Visit the lounge</h2>
          {s?.address ? (
            <p className="preserve-lines">{s.address}</p>
          ) : (
            <p>Contact the salon for the confirmed address.</p>
          )}
          {s?.phone && (
            <p>
              <a href={`tel:${s.phone.replace(/[^+0-9]/g, "")}`}>{s.phone}</a>
            </p>
          )}
          {s?.email && (
            <p>
              <a href={`mailto:${s.email}`}>{s.email}</a>
            </p>
          )}
          <div className="actions">
            {s?.instagram_url && (
              <a href={s.instagram_url} rel="noopener noreferrer">
                Instagram ↗
              </a>
            )}
            {s?.facebook_url && (
              <a href={s.facebook_url} rel="noopener noreferrer">
                Facebook ↗
              </a>
            )}
          </div>
        </article>
        <article className="card">
          <h2>Opening hours</h2>
          {s?.hours.length ? (
            <dl>
              {weekdays.map((day, index) => {
                const h = s.hours.find((h) => h.weekday === index);
                return (
                  <div className="schedule-row" key={day}>
                    <dt>{day}</dt>
                    <dd>
                      {h
                        ? `${h.opens_at.slice(0, 5)}–${h.closes_at.slice(0, 5)}`
                        : "Closed"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p>Opening hours will be published once confirmed by Delia.</p>
          )}
          <p>Special closures may affect appointment availability.</p>
        </article>
        <article className="card">
          <h2>Time for you</h2>
          <p>Explore the salon menu and find your next appointment.</p>
          <Button href="/book">Book your visit</Button>
        </article>
      </div>
    </section>
  );
}
