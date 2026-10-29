# Cosmetic manifest and renderer prototype (2026-10-28)

<!-- cspell:words loadouts -->

The isolated prototype in `lib/binary2048/cosmetic-theme-manifest.ts` validates
versioned manifests and resolves a loadout into ordered background, surface,
frame, slot, tile, and icon layers.

Validation covers stable IDs, schema/minimum-renderer versions, owned-origin
URLs, MIME, dimensions, two-megabyte per-asset cap, SHA-256 content hashes,
creator/license provenance, fallbacks, complete number/zero/wildcard/Lock-0
coverage, compatible rulesets, focus/text tokens, non-color cues, and
reduced-motion assets.

The resolver proves mixed-theme loadouts and server-supplied ownership lists.
Any unowned, missing, invalid, or incompatible part restores the whole base
theme atomically. Its render plan contains no grid, score, RNG, replay, or other
deterministic gameplay state. Runtime fetching/caching is intentionally not
promoted into the game UI until the rendering comparison and asset/performance
budgets pass.
