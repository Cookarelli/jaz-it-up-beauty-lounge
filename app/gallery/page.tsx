import Image from "next/image";
import { Intro, Placeholder } from "@/components/site";
import { galleryPhotos } from "@/lib/gallery-photos";
import styles from "./gallery.module.css";

export const metadata = {
  alternates: { canonical: "/gallery" },
  title: "Gallery",
};

export default function Gallery() {
  return (
    <section>
      <Intro eyebrow="A LITTLE INSPIRATION" title="Looks to look forward to">
        A space for fresh cuts, beautiful color, and the details we love.
      </Intro>
      {galleryPhotos.length > 0 ? (
        <div className={styles.gallery} aria-label="Jaz It Up Beauty Lounge photo gallery">
          {galleryPhotos.map((photo) => (
            <figure className={styles.item} key={photo.src}>
              <a
                className={`${styles.photoLink} ${photo.presentation === "collage" ? styles.collageLink : ""}`}
                href={photo.src}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View full-size photo: ${photo.alt} (opens in a new tab)`}
              >
                <Image
                  className={`${styles.photo} ${photo.presentation === "collage" ? styles.collagePhoto : ""}`}
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 620px) 100vw, (max-width: 1050px) 50vw, 33vw"
                />
              </a>
              {(photo.caption || photo.category) && (
                <figcaption className={styles.caption}>
                  {photo.category && (
                    <span className={styles.category}>{photo.category}</span>
                  )}
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <>
          <div className="cards">
            {["Fresh perspectives", "Beautiful dimension", "Finishing touches"].map(
              (label) => (
                <Placeholder key={label} label={label} />
              ),
            )}
          </div>
          <p className="muted">
            Our gallery is coming soon. These are decorative placeholders, not
            photographs of salon work.
          </p>
        </>
      )}
    </section>
  );
}
