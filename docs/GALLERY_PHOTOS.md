# Jaz It Up Beauty Lounge — gallery photo handoff

The gallery contains four images supplied and explicitly selected for gallery
use by the project owner on October 16, 2026 ("here are three for the gallery.
More to come"). These are user-supplied screenshots, not original camera files
or images downloaded from Google. Additional approved photos can be appended
to the existing manifest without rebuilding the gallery.

## Source and approval

On October 16, 2026, the public Google Maps listing was verified directly:

- **Jaz It Up Beauty Lounge**, 6064 Nimtz Ct, Loves Park, IL 61111.
- Listed telephone: **(815) 222-0262** (reference only; no site contact settings changed).
- [Google Business Profile on Maps](https://www.google.com/maps/place/Jaz+It+Up+Beauty+Lounge/@42.3319998,-88.9958826,17z/data=!3m1!4b1!4m6!3m5!1s0x8808bc118a574ac1:0x9b7b838cf82b8ae7!8m2!3d42.3319998!4d-88.9958826!16s%2Fg%2F1tdvq9p_).

This identifies the matching public listing; it does not verify who manages
the profile or grant permission to reproduce its photos. Reviewer-uploaded
photos are present. No Google image endpoint was scraped and no photos were
downloaded, hotlinked, or substituted with stock imagery.

### Supplied batch — October 16, 2026

| Supplied screenshot | Local WebP | Dimensions | Bytes |
| --- | --- | --- | --- |
| 10.06.00 PM | `salon-styling-stations.webp` | 1346 × 908 | 167,650 |
| 10.06.12 PM | `jaz-it-up-mirror-logo.webp` | 748 × 920 | 37,858 |
| 10.07.10 PM | `textured-curls-tapered-cut.webp` | 746 × 820 | 51,160 |
| 9.52.54 PM | `hair-extensions-before-and-after.webp` | 739 × 1600 | 76,798 |

Source: the attachments supplied in the project conversation. The user's
selection authorizes this batch; no separate statement from Delia is claimed.
Do not infer blanket approval for other Google/reviewer photos.

Converted with Sharp to WebP at quality 82, with orientation normalization and
no upscaling. EXIF, ICC, XMP, and IPTC are absent from all four outputs. Combined
size is 333,466 bytes, down from 4,932,321 bytes (about 93% smaller). Screenshot
content is retained, including the interior image's viewer arrow; the gallery's
existing portrait crop hides that edge, while the full-size link shows the
complete supplied frame. The extensions screenshot is framed with CSS around
both photos, the original caption, and the PicCollage mark; the full-size asset
retains the social interface. The second attachment was explicitly selected
with "add these". Camera originals would improve source quality and
remove screenshot UI without reconstructing the photography.

### Handoff for additional photos

For subsequent batches, provide:

- Original full-resolution JPG, PNG, HEIC, or WebP files, as attachments or an
  accessible download folder/ZIP. Use phone/computer originals or an authorized
  export, not screenshots or temporary Google Maps image links.
- A filename list identifying exactly which images she approves for this
  public website, with confirmation that she owns each photo or has permission
  from its photographer/rightsholder to publish it. For a reviewer photo,
  include the reviewer's explicit reuse permission.
- Confirmation of website-publication consent for any identifiable clients.
- For each selected file, the service or subject shown (Color, Cuts, Styling,
  The Lounge, or Other), any desired caption, and any crop restrictions. Do not
  include client names or other private details unless specifically approved.

Suggested approval wording: “I approve [filenames] for publication on the Jaz
It Up Beauty Lounge website. I own these photos or have permission from their
rightsholders for this use, and identifiable clients have consented.” Keep
private consent records outside this public repository; record only the
necessary approval reference with the handoff.

### Processing after receipt

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

## Earlier verification — before the supplied batch

Existing gallery implementation and empty manifest preserved; this follow-up
changes only this handoff document. No approved originals were available to
optimize or add to `public/images/gallery/`.

- `npm run lint`: passed (Node 24.13.0).
- `npm run typecheck`: passed (Node 24.13.0).
- `npm run build`: blocked by a Turbopack worker port error, `Operation not
  permitted`; retry outside the sandbox returned the same error.
- `npm run build -- --webpack`: passed (Node 24.13.0), including prerendering
  `/gallery`. No build or deployment configuration was changed for the fallback.
- `git diff --check`: passed.
- Source inspection confirms local Next Image paths, descriptive alt/link
  fields, semantic figures/captions, responsive 3/2/1-column styles, global
  focus styling, and reduced-motion handling. This is not a browser
  accessibility audit.
- Actual photo loading, visual mobile/desktop review, crop quality, accurate
  per-photo alt text/captions, metadata removal, and browser accessibility
  verification remain pending approved originals. No populated-gallery test
  is claimed for an empty manifest.

## Verification — supplied photos

The existing gallery was populated rather than rebuilt. Added four local WebP
assets and accurate manifest entries. The collage has a dedicated CSS frame
that retains both photos, its original caption, and its creator mark. Full-size
links announce their new-tab behavior, and an inset gold focus indicator paints
above the photos instead of being clipped by the cards.

- All four optimized assets have no EXIF/ICC/XMP/IPTC metadata.
- Lint, standalone TypeScript, and the Webpack production build pass on Node
  24.13.0. The default Turbopack port limitation is recorded above; no build
  settings were changed.
- Browser checks: local image optimizer loads the supplied photos, descriptive
  alt text and captions appear in the accessibility tree, and keyboard links
  show a visible focus indicator. These are focused manual checks, not a claim
  of full WCAG certification.
- Responsive gallery: one column at 390px, two at 820px, three at 1280px; no
  horizontal overflow. Both views in the extensions collage remain visible.
- No database, booking, payment, messaging, deployment, or launch-setting
  changes. No production deployment was performed.
