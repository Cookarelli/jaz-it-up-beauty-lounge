import { Intro, Placeholder } from "@/components/site";
export const metadata = { title: "Gallery" };
export default function Gallery() {
  return (
    <section>
      <Intro eyebrow="A LITTLE INSPIRATION" title="Looks to look forward to">
        A space for fresh cuts, beautiful color, and the details we love.
      </Intro>
      <div className="cards">
        {["Fresh perspectives", "Beautiful dimension", "Finishing touches"].map(
          (x) => (
            <Placeholder key={x} label={x} />
          ),
        )}
      </div>
      <p className="muted">
        Our gallery is coming soon. These are decorative placeholders, not
        photographs of salon work.
      </p>
    </section>
  );
}
