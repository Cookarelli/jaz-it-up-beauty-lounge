export const dynamic = "force-dynamic";
import { Intro, Button } from "@/components/site";
import { catalog } from "@/lib/catalog";
import {
  formatPrice,
  formatDuration,
  bookable,
  type Service,
} from "@/lib/service-types";
export const metadata = {
  alternates: { canonical: "/services" },
  title: "Services",
};
function Offering({
  s,
  parentId,
  live,
}: {
  s: Service;
  parentId?: string;
  live: boolean;
}) {
  return (
    <div className="offering">
      <h3>{s.name}</h3>
      <p>
        {formatPrice(s)} · {formatDuration(s)}
      </p>
      {s.length_qualification !== "any" && (
        <p>Hair length: {s.length_qualification.replaceAll("_", " ")}</p>
      )}
      {live && bookable(s) ? (
        <Button
          secondary
          href={`/book?service=${parentId || s.id}${parentId ? `&variant=${s.id}` : ""}`}
        >
          Choose this service
        </Button>
      ) : (
        <p className="muted">
          {s.variants?.length
            ? "Choose a variant below."
            : "Owner review required · ask the salon before booking."}
        </p>
      )}
    </div>
  );
}
export default async function Services() {
  const { services, live } = await catalog();
  return (
    <section>
      <Intro eyebrow="A LITTLE SOMETHING FOR YOU" title="The service menu">
        Explore the salon menu. Starting prices may vary with the consultation;
        board ranges are shown as supplied.
      </Intro>
      <p className="notice">
        All chemical services include haircut and style in one appointment.
        Services awaiting price or timing approval remain visible, but cannot be
        booked instantly.
      </p>
      {Array.from(new Set(services.map((s) => s.category))).map((category) => (
        <div key={category}>
          <h2>{category}</h2>
          <div className="cards">
            {services
              .filter((s) => s.category === category)
              .map((s) => (
                <article className="card" key={s.id}>
                  <Offering s={s} live={live} />
                  <p>{s.description}</p>
                  {s.includes_cut_style && (
                    <strong>Haircut & style included</strong>
                  )}
                  {s.variants?.map((v) => (
                    <Offering key={v.id} s={v} parentId={s.id} live={live} />
                  ))}
                </article>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
