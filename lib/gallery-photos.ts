/**
 * Photos supplied and selected by the project owner for the Jaz It Up website.
 *
 * Put locally hosted, optimized image files in public/images/gallery/ and
 * list each approved image below. Do not link to temporary Google Maps image
 * URLs or copy customer/reviewer-uploaded media without permission.
 */
export type GalleryPhoto = {
  src: `/images/gallery/${string}`;
  alt: string;
  caption?: string;
  category?: "Color" | "Cuts" | "Styling" | "The Lounge" | "Other";
  presentation?: "collage";
};

export const galleryPhotos: GalleryPhoto[] = [
  {
    src: "/images/gallery/jaz-it-up-mirror-logo.webp",
    alt: "Gold Jaz It Up Beauty Lounge lettering with scissors, a comb, and clippers on a mirror",
    caption: "A little Jaz It Up personality",
    category: "The Lounge",
  },
  {
    src: "/images/gallery/textured-curls-tapered-cut.webp",
    alt: "Side and back view of short brown curls with closely tapered sides and a longer textured top",
    caption: "Texture on top, neatly tapered sides",
    category: "Cuts",
  },
  {
    src: "/images/gallery/salon-styling-stations.webp",
    alt: "Styling stations with framed mirrors, a ring light, salon chairs, and carts of hair products and tools",
    caption: "Inside the lounge",
    category: "The Lounge",
  },
  {
    src: "/images/gallery/hair-extensions-before-and-after.webp",
    alt: "Hair extensions collage showing long, straight blonde hair above and the shorter shoulder-length hair before extensions below",
    caption: "Hair extensions: before and after",
    category: "Styling",
    presentation: "collage",
  },
];
