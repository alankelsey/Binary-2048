# Cosmetic catalog contract (2026-10-28)

<!-- cspell:words hitboxes -->

## Product boundary

Cosmetics may change only presentation. They never change grids, rules, spawn
odds, score, input geometry, hitboxes, accessibility semantics, replay hashes,
simulation, or leaderboard eligibility.

## Catalog and ownership

Catalog products reference immutable cosmetic revisions and may contain tile
sets, number/icon sets, slots, frames, surfaces, backgrounds, or bundles.
Rarity is descriptive merchandising metadata only; it does not alter utility.
Rotation is permitted only for discovery, never to remove an owned entitlement.

Purchases create durable, append-only entitlement events keyed by account,
product, cosmetic revision, source, receipt, and timestamp. Current consumable
inventory balances are not reused. A materialized ownership view may be rebuilt
from the ledger and follows the authenticated account across devices.

## Preview, purchase, and loadout

- Preview never grants ownership and is visibly labeled; it uses the same
  validated renderer with a temporary loadout.
- Equip is a separate authenticated action. The server validates every selected
  part against durable ownership before persisting a versioned loadout.
- Missing, revoked, corrupt, or incompatible parts atomically restore the base
  theme rather than producing a partially broken board.
- Bundles grant their enumerated immutable components; future bundle additions
  do not silently grant new products.
- Cross-device state is last-write-wins by loadout revision, with the complete
  prior loadout retained for support/audit.

## Receipts, refunds, and gifting

Real-money checkout is not approved by this contract. Before it is added,
webhooks must be signed, replay-safe, idempotent by provider event and receipt,
and reconciled against the provider API. A refund revokes only the associated
entitlements and records a compensating event; it never deletes purchase
history. An equipped revoked item falls back to base.

Gifting is deferred. If introduced, it requires sender ownership/payment
proof, recipient acceptance, anti-fraud limits, refund ownership rules, and an
immutable transfer ledger. Account-to-account resale is not supported.

## Accessibility and support

Every theme declares readable text/focus tokens, non-color cues for special
tiles, reduced-motion/static assets, supported rulesets, and complete fallback.
Support tooling may inspect entitlement/loadout IDs and revisions but not
payment credentials. Players can restore the base theme without contacting
support.
