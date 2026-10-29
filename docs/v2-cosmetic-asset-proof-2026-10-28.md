<!-- cspell:words deuteranopia hotspots protanopia tritanopia WCAG -->

# Cosmetic asset proof (2026-10-28)

## Outcome

The original Workbench v1 proof supplies the requested wood/brass/felt board,
jewel tile atlas, crop-safe responsive background, and the existing CSS jewel
sheen sample. It is isolated from deterministic gameplay and is available only
on the development-only `/cosmetic-proof` review route; production returns 404.
This completes the small asset proof, not the separate physical-Pixel renderer
comparison or the cosmetic spike exit criterion.

The bitmap generator supplied textures only. `2048`, `0`, `WILD`, and `LOCK 0`
are deterministic HTML text with visible borders and distinct star, ring, and
lock cues. Generated pixels therefore cannot change a tile's meaning or its
accessible name.

## Immutable asset record

| Asset | Repository location | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Board | `/themes/workbench-proof-v1/board.jpg` | 1024 × 1024 | 348,646 | `fa8f918e213a5e3f752cf37cc164c2da37cbb37230212c1e09e8bf69c9e3dbb6` |
| Jewel atlas | `/themes/workbench-proof-v1/jewel-tile-atlas.png` | 768 × 768 | 1,080,310 | `a73157db87d0fe3d6aa17388c120b794ee29bdafebfcf1b9ff142c03ed509657` |
| Page background | `/themes/workbench-proof-v1/page-background.jpg` | 1600 × 900 | 344,178 | `3ba926cdc14fbbfe36c063907cf06bd1d1dc55d488a457b525f2a317b42838e7` |

The checked-in manifest repeats dimensions, byte counts, hashes, supported tile
types, accessibility tokens, and local URLs. Its test reads each file and
recomputes its size and hash. Derived JPEGs use quality-bounded compression; the
atlas is reduced to 768 px while retaining alpha. The three selected files total
1,773,134 bytes and each stays below the 2 MB manifest cap.

## Provenance, ownership, and permitted use

- Creator/generator: OpenAI built-in image generation, directed by the Binary
  2048 project owner on 2026-10-28. No source image, franchise, artist name, or
  third-party visual reference was supplied.
- Repository custody: the project owner controls these checked-in copies and
  their project-specific selection, crop, compression, markup, and composition.
- License record: no third-party stock or open-source asset license applies.
  Generator output remains subject to the applicable OpenAI terms for the
  account that generated it. The official product documentation explains image
  generation but does not itself establish a separate asset license, so this
  record does not invent one.
- Allowed derivatives for this spike: project-local resizing, compression,
  cropping, color adjustment, atlas extraction, and composition with Binary
  2048 markup. Public store sale, sublicensing, or representation as exclusively
  human-authored is held for a release/legal review.
- Release boundary: these files are proof assets, not an approved commercial
  cosmetic. The development-only route, manifest, and renderer may be changed or
  removed without replay or gameplay migration.

OpenAI's current official documentation confirms that its image-generation
feature creates or edits images from prompts and supports transparent PNG output,
which is the capability used here. It does not answer the project-specific legal
review above: <https://developers.openai.com/api/docs/guides/image-generation>.

## Generation prompts

All three images used the built-in generator. The exact final prompts were:

### Board

```text
Use case: stylized-concept
Asset type: Binary 2048 cosmetic proof, orthographic square board surface
Primary request: Create a polished, original, top-down square 4-by-4 game board made from dark walnut wood, aged brass trim, and deep navy felt.
Scene/backdrop: Isolated board filling the canvas, viewed perfectly orthographically from directly above.
Subject: A square wood frame with restrained brass corner and edge details surrounding sixteen identical empty navy-felt slots in an exact 4-by-4 grid.
Style/medium: Premium realistic game asset, subtle tactile materials, production-ready raster texture.
Composition/framing: Perfectly centered and square; symmetric; generous outer frame; exact straight grid lines; no perspective, tilt, foreshortening, or cropped edges.
Lighting/mood: Soft diffuse studio light, restrained highlights, no dramatic shadows.
Color palette: Dark walnut brown, antique brass, deep navy felt.
Materials/textures: Fine wood grain, lightly patinated brass, woven felt; quiet enough for high-contrast tile overlays.
Constraints: No tiles, numbers, icons, labels, text, logo, UI controls, characters, watermark, perspective, or background scene. Preserve an exact readable 4-by-4 slot layout. Original design, not based on a franchise.
```

### Jewel tile atlas

```text
Use case: stylized-concept
Asset type: Binary 2048 cosmetic proof, orthographic jewel tile atlas
Primary request: Create a clean 2-by-2 atlas of four separate square jewel-and-brass game tiles, designed as neutral backgrounds for deterministic HTML number and icon overlays.
Scene/backdrop: Transparent background outside the four tiles.
Subject: Four equally sized square beveled tiles: sapphire blue, emerald green, amethyst purple, and smoky dark ruby. Each has a restrained antique-brass rim and a broad quiet center area.
Style/medium: Premium realistic game UI assets, original design, crisp edges, subtle gemstone translucency.
Composition/framing: Perfectly orthographic front view; exact 2-by-2 grid; equal gutters; all four tiles fully visible and consistently sized.
Lighting/mood: Soft studio highlights confined to edges; center areas remain calm and dark enough for large high-contrast white or cream labels.
Color palette: Sapphire, emerald, amethyst, smoky ruby, antique brass.
Materials/textures: Faceted bevel only near the border, polished but not mirror-like.
Constraints: No text, numbers, letters, symbols, icons, logos, characters, watermark, perspective, tilt, cast shadows, or background scene. Four tiles only. Transparent canvas outside tiles. Original design, not based on a franchise.
```

### Responsive page background

```text
Use case: stylized-concept
Asset type: Responsive page background for a Binary 2048 cosmetic proof
Primary request: Create a wide, calm dark-navy felt and walnut tabletop background with restrained antique-brass inlay accents.
Scene/backdrop: Abstract material surface only, suitable behind a centered square game board.
Subject: Deep navy woven felt across most of the image, framed by subtle dark-walnut edges and a few thin geometric antique-brass inlay lines.
Style/medium: Premium realistic material texture, original design, production-ready raster background.
Composition/framing: Wide 16-by-9 landscape; texture and framing should crop safely at narrow mobile and wide desktop aspect ratios; center 50 percent kept visually quiet for UI; no strong focal point.
Lighting/mood: Soft even ambient light, low contrast, sophisticated and unobtrusive.
Color palette: Deep navy, near-black blue, dark walnut, muted antique brass.
Materials/textures: Fine felt weave, understated wood grain, lightly patinated brass.
Constraints: No board grid, tiles, numbers, symbols, icons, text, logo, UI controls, characters, objects, watermark, perspective scene, or bright hotspots. Original design, not based on a franchise.
```

## Accessibility and responsive checks

- Light and dark component variants preserve visible text-and-shape cues. Labels
  sit on 82%-opaque black badges; even over a white atlas pixel, white text has a
  calculated contrast ratio above WCAG AA's 4.5:1 threshold.
- Default, deuteranopia, protanopia, and tritanopia variants retain literal text
  and distinct borders/shapes; hue is never the only special-tile signal.
- Browser checks cover a 320 px viewport and a 160 px effective CSS viewport,
  representing 320 px at 200% zoom. The four tiles reflow from four columns to
  two without horizontal document overflow.
- With `prefers-reduced-motion: reduce`, the sheen has `animation-name: none`
  and keeps a static low-opacity highlight. Forced-colors mode removes bitmaps
  from the tile samples and uses system colors.
- Large-value legibility is represented by `2048`; labels use bounded responsive
  type, wrap safely, and keep a solid backing instead of relying on jewel color.

## Decision

Keep Workbench v1 as a local raster/CSS proof. Do not integrate it into gameplay
or the store yet. Production format selection still depends on the unchecked
CSS/SVG-versus-sprite-versus-WebGL comparison on the target Pixel.
