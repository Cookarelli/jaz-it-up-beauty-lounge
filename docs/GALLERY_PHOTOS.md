# Jaz It Up Beauty Lounge — gallery photo handoff

The website currently has placeholders, not salon photography. This branch
prepares a responsive gallery for **Delia-approved originals**; it does not
publish or misrepresent photographs found on unrelated internet listings.

## Source and approval

The Google Business Profile appears under **Jaz It Up Beauty Lounge**, at
6064 Nimtz Ct, Loves Park, IL 61111. Confirm the listing with Delia before
using any media. Photos visible on the profile may belong to Delia, a client,
or a reviewer; a public Google listing is not a blanket reuse license.

1. Have Delia supply the original photographs from her phone, computer,
   or Google Photos where possible, rather than scraping or hotlinking Google.
   If using an export from her own Business Profile, confirm each photo was
   uploaded by her or is otherwise licensed for reuse.
2. Ask Delia to select a good mix of cuts, color, styling, and interior
   pictures, and verify client consent for identifiable client portraits.
   Exclude reviews/reviewer photos without express reuse permission.
3. Convert approved photos into appropriately compressed WebP or JPEG files,
   roughly 1200–1600 pixels on the longest edge. Correct orientation and
   remove EXIF geolocation metadata. Use descriptive lowercase filenames.
4. Add them to `public/images/gallery/`. Do not commit the original files
   if they carry sensitive metadata or are unapproved.
5. Add entries to `lib/gallery-photos.ts`, providing accurate descriptions
   in `alt`, optional `category` and `caption`, and unique `src` paths.
   Captions must not claim a technique/result the image does not prove.
6. Test with `npm ci && npm run lint && npm run typecheck && npm run build`.
   Review desktop/mobile layout and verify all photos load from the site's
   own /images/gallery/... URLs.

## Deployment boundary

Do not deploy to Production, enable public booking, messaging, payments, or
indexing, alter Supabase migrations, or change pricing/hours as part of photo
work. A preview is enough for Delia's approval. No paid hosting or Google
service is required for the photo gallery.
