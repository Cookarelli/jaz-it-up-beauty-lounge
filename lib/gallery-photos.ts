/**
 * Photos approved by Delia for display on the public Jaz It Up website.
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
};

export const galleryPhotos: GalleryPhoto[] = [
  // Add Delia-approved salon photos here after the original image files
  // have been received and their publication rights confirmed.
  //
  // {
  //   src: "/images/gallery/sample-color-result.webp",
  //   alt: "Example of hair coloring at Jaz It Up Beauty Lounge",
  //   caption: "Color and dimension",
  //   category: "Color",
  // },
];
