# V2 Phase 7 cherry-blossom theme viability spike

Date: 2026-10-27 America/Boise

Status: viable as an optional experimental theme. The source artwork is owned
by the user. A clean, tile-free derivative was produced for this bounded spike;
the original flattened 6 × 3 composition is not shipped as game UI.

## Construction

- The playable grid remains semantic HTML with the existing grid and gridcell
  names, focus behavior, keyboard controls, and touch handling.
- The floral artwork is a board background only. Tiles are separately rendered,
  fully opaque CSS surfaces, so artwork never reduces number or special-tile
  legibility.
- The theme is optional and labeled `Cherry Blossom (Experimental)`; Original
  remains the default and existing saved theme selection behavior is retained.
- The runtime JPEG is 1024 × 1024 and approximately 184 KB. The background uses
  `cover` with a centered focal point so 4 × 4 and custom square boards do not
  depend on baked slots.
- Reduced-transparency and forced-colors modes replace the image with a flat
  system-compatible board surface.

## Acceptance gates

- Automated browser acceptance must prove the option, persistence, 390 px
  containment, background loading, 16 semantic cells, and opaque empty tiles.
- Existing theme unit tests, TypeScript, lint, and focused gameplay/mobile
  browser suites must remain green.
- A visual capture must be inspected at mobile size before the experiment is
  called viable. Large-value, zero, wildcard, Lock-0, color-vision, 200% zoom,
  and physical-device checks remain required before removing the experimental
  label or treating this as the upload-background implementation.

This spike informs the separate player-upload pipeline. It does not add file
upload, object storage, moderation, public sharing, or arbitrary image URLs.

## Result

The focused theme tests and existing mobile-dock suite passed 17 browser tests,
including a 5 × 3 fixture with 2048, zero, wildcard, and Lock-0 tiles.
The theme helper suite passed 5 unit tests, and TypeScript passed. A 390 × 844
active-game capture was inspected after the New Game overlay closed: the floral
image remained visible in the board gutters, the board stayed within the
viewport, opaque cells prevented visual interference, and number tiles remained
dominant. The experiment is therefore viable, but remains labeled experimental
until the promotion checks above are complete.
