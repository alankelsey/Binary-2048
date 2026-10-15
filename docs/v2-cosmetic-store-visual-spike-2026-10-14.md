# V2 cosmetic store and visual asset spike

Date: 2026-10-14

Status: research spike added to the V2 plan. No catalog, purchase, upload, or
production theme behavior is approved by this document.

## Concept reading

The two supplied 1174×896 concepts suggest two related directions:

- a stylized workbench with warm wood, brass dividers, patterned recesses,
  jewel-like tiles, stronger outlines, and colorful control accents; and
- a restrained premium desk with darker wood, brushed metal, navy felt slots,
  ceramic/gem tiles, shallow shadows, and subdued controls.

Useful reusable ideas are material contrast, inset board slots, a distinct
frame/surface/background hierarchy, beveled tile silhouettes, highlight and
shadow layers, and tile materials that reinforce value tiers. The concepts also
bake the whole interface into one perspective image. That angle would distort a
responsive HTML grid, make square hit targets appear trapezoidal, and couple the
board art to one screen size. Production assets should therefore be recreated,
not cropped from the concepts.

Before derivative work begins, record the reference files' immutable location,
generator/creator, prompting owner, creation date, and permitted commercial and
derivative use. The supplied files are references only; their filenames are not
sufficient provenance or a license.

## Turning the ideas into web assets

1. Choose a camera and grid contract first. Use orthographic top-down or a very
   shallow fixed tilt. Keep the interactive board a square CSS grid; depth is a
   visual layer inside each square and never moves the hitbox.
2. Rebuild the board as layers in Figma, Affinity Designer, Photoshop, or
   Blender: page background, board surface, scalable frame, slot/recess,
   tile body, tile face/material, number/icon, highlight, shadow, and optional
   effect. Do not include score, buttons, text, or game state in the artwork.
3. For a true 3D source, model one board corner, one repeatable slot, and one
   parameterized tile in Blender. Render with an orthographic camera and fixed
   light rig. Reuse the same camera, padding, and shadow bounds for every tile.
4. Export scalable frame pieces as CSS/SVG or a nine-slice image. Export tile
   bodies and special-tile overlays with transparency at consistent 1× and 2×
   sizes. Export photographic/material backgrounds as AVIF plus WebP fallback.
   Keep editable source files outside runtime bundles and check in optimized
   derivatives with their licenses/provenance.
5. Keep numbers and accessibility labels in HTML when possible. A tile skin can
   change the body and effects while the value remains sharp, localizable, and
   readable at large powers. Wildcard and Lock-0 need distinct non-color cues.
6. Package each theme with a versioned manifest that names its frame, slots,
   surface, tile family, special-tile overlays, background, animation profile,
   contrast mode support, reduced-motion fallback, and asset hashes.
7. Test the theme at 320px, common Pixel widths, desktop, 200% zoom, all current
   color-vision modes, very large tile values, fullscreen, and terminal/tutorial
   overlays. Profile decoded memory and composite cost on the target Pixel.

The renderer decision record must turn the manifest into a validated schema. At
minimum it needs stable theme/part IDs, schema and minimum-renderer versions,
owned-origin asset URLs, MIME type, intrinsic size and DPR, byte size, content
hash, provenance/license, fallback IDs, static/animated pairs, accessibility
tokens, and supported rulesets/tile types. Rendering stays client-side, but the
server must verify ownership before accepting an equipped loadout.

Base HTML/CSS tiles render immediately. A cosmetic pack loads outside the move
input-to-paint path, decodes fully, and swaps atomically; a missing or corrupt
part restores the whole base theme. Content-hashed derivatives may be cached
immutably. Offline support means a previously cached pack plus a guaranteed base
fallback unless a later cache design explicitly proves more.

Set numeric pass/fail budgets before producing the proof: initial and optional
transfer bytes, decoded bytes and texture dimensions, simultaneous animated
tiles and frame rate, input-to-next-frame regression, LCP/CLS impact, and a
low-memory fallback. Measure cold and warm cache on the target Pixel.

## Animation approach

Use motion as a small tile treatment rather than running a video in every cell.
Good first proofs are a CSS shimmer, a two-layer parallax highlight, a short
12–15 fps sprite loop, or a compact vector animation. Limit simultaneous loops,
pause offscreen/hidden animation, avoid layout changes, and ship a static frame
for reduced motion and low-power devices. Original animated illustrations are
possible, but each must have documented rights; recognizable anime franchises,
characters, logos, and copied artist signatures should not enter the catalog.

## Player-uploaded backgrounds

Treat uploads as untrusted media. Upload directly to isolated object storage by
short-lived signed request, enforce a small byte and pixel limit, decode the
image with a server-side image library, strip metadata and color-profile hazards,
reject animation initially, generate fixed AVIF/WebP derivatives, and serve only
those derivatives from a media origin. Store crop/focal position separately.

The product decision must also cover authentication/tier, private versus shared
visibility, moderation and reporting, copyright attestation, automated scanning,
human appeal, storage/egress quotas, deletion and user-data export, retention,
blocked-image hashes, and behavior when moderation or processing is unavailable.
An uploaded file must never be interpreted as SVG, HTML, CSS, JavaScript, a data
URL, or an arbitrary remote URL.

The upload spike must choose infrastructure that does not yet exist in this
repository: quarantine storage, an asynchronous decode/re-encode/scan worker,
moderation state, an approved derivative origin, retry/orphan cleanup, deletion
and cache-purge timing, and hard monthly storage/processing/egress limits. Apply
EXIF orientation, normalize decoded pixels to sRGB, cap bytes, dimensions,
frames, and decode time, reject animation and malformed or polyglot files,
randomize object keys, and serve only re-encoded derivatives with `nosniff`.
Keep the first upload proof private; public sharing requires a separate
moderation and abuse decision.

## Product and deterministic-state boundaries

The current quantity-based consumable inventory cannot represent permanent
cosmetic ownership. Define a separate durable entitlement and versioned loadout
model with idempotent grants, revocation/refund behavior, fallback loadouts, and
cross-device conflict rules. Preview/equip development remains separate from
real-money checkout; sale requires verified price configuration, tax/region and
refund policy, webhook reconciliation, receipts, and restore-purchase behavior.

Cosmetic and upload IDs stay outside deterministic game state, ranked integrity,
recovery snapshots, and simulations. Shared replays use either the viewer's
loadout or a public theme ID with a base fallback and never contain entitlement
tokens or private media URLs.

Accessibility modes override cosmetic tokens. Themes cannot alter focus rings,
status text, hitboxes, number legibility, or special-tile non-color cues. Provide
contrast floors and a scrim for arbitrary backgrounds, forced-colors and static
fallbacks, and an in-product animation-off setting alongside
`prefers-reduced-motion`.

## Recommended first proof

Create one orthographic wood/brass/felt theme from clean source layers. Use a
nine-slice frame, a repeatable felt slot texture, one parameterized beveled tile
body recolored by CSS variables or generated variants, HTML numbers, separate
zero/wildcard/Lock-0 overlays, and one subtle shimmer with a static fallback.
This proves most of the concept value without committing to a WebGL renderer or
an upload service.

The production handoff must specify logical tile, slot, and frame sizes, 1×/2×
export dimensions, transparent padding and shadow bounds, nine-slice cap insets,
sRGB and alpha handling, filenames, and a contact sheet covering every number
tier, special state, focus/contrast mode, and large-value fit.
