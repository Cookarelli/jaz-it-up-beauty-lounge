import { Intro, Button } from "@/components/site";
import { catalog } from "@/lib/catalog";
export const metadata = { title: "Services" };
export default async function Services() {
  const { services, live } = await catalog();
  return (
    <section>
      <Intro eyebrow="A LITTLE SOMETHING FOR YOU" title="The service menu">
        Find your fresh start. Every appointment begins with a conversation
        about your hair and your goals.
      </Intro>
      {!live && (
        <p className="notice">
          An introduction to our services. Delia’s confirmed menu and pricing
          will appear here before booking opens.
        </p>
      )}
      <div className="cards">
        {services.map((s) => (
          <article className="card" key={s.id}>
            <span className="eyebrow">{s.category}</span>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            {live && (
              <p>
                {s.duration_minutes} minutes · $
                {(s.price_cents / 100).toFixed(2)}
              </p>
            )}
            <Button secondary href={`/book?service=${s.id}`}>
              Choose this service
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
