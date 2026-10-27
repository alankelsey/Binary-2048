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
- Background and tile treatment are independent persisted controls. Players can
  switch between Default and Cherry Blossom backgrounds, choose Normal or
  Opaque tiles, and set board and opaque-tile colors without changing the page
  theme or color-vision mode.
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
The theme helper suite passed 7 unit tests, and TypeScript passed. A 390 × 844
active-game capture was inspected after the New Game overlay closed: the floral
image remained visible in the board gutters, the board stayed within the
viewport, opaque cells prevented visual interference, and number tiles remained
dominant. The experiment is therefore viable, but remains an experimental
background option until the promotion checks above are complete.

A follow-up separated visual choices into Background and Tiles selectors plus a
Colors disclosure with board and opaque-tile pickers. Browser acceptance proves
Default/Cherry Blossom and Normal/Opaque can be mixed, both custom colors apply,
and all four values persist across reload. The first mobile capture exposed
overlapping two-column controls; the final single-column 390 px capture was
inspected with all labels, selectors, and both 44 px color inputs unobstructed.
