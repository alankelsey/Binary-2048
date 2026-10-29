<!-- cspell:words RGBA -->

# Cosmetic animation prototype (2026-10-28)

Three original presentation-only treatments are checked in as an isolated
React/CSS prototype: brass glint, jewel sheen, and a wildcard orbit. They use
CSS gradients and one vector glyph, add no bitmap transfer, are hidden from the
accessibility tree, do not accept input, and are not imported by gameplay.

## Budgets

- Maximum animated tiles in a future production board: 4; additional instances
  render their static first frame.
- Asset transfer: 0 bytes for these treatments; no video or per-cell canvas.
- Animation properties: transform and opacity only; no layout-affecting
  properties.
- Target: 60 fps with no input-to-next-frame regression above 4 ms on the
  target Pixel and no new long task over 50 ms.
- Decoded bitmap/texture memory: 0 for this proof. A future sprite alternative
  remains capped at one 1024 × 1024 RGBA atlas (4 MiB decoded).
- Loop durations: 1.6 seconds for glint/sheen and 2.4 seconds for orbit, with
  stagger limited to 80 ms per active tile.
- Hidden/offscreen production instances must pause; that lifecycle is not
  needed in this unmounted prototype.

`prefers-reduced-motion` removes every animation and retains a low-opacity
static effect. Forced-colors mode removes decorative effects and uses system
colors. Promotion requires the separate CSS/SVG, sprite, and WebGL comparison
on the physical target device.
