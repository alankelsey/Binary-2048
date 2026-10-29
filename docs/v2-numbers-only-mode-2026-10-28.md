# Numbers-only game mode (2026-10-28)

## Shipped contract

Numbers only is an explicitly identified, versioned, unranked game mode:

- mode: `numbers-only`;
- ruleset identity: `binary2048-v2-numbers-only`;
- schema version: 1;
- spawn distribution: 100% number 1, with zero, wildcard, and Lock-0 all 0%;
- merge, scoring, win, game-over, no-op, and undo behavior: the existing
  deterministic numeric rules from the V1 engine;
- initial boards and imports reject every special tile and invalid number;
- game export, deterministic replay import, signed recovery, and API responses
  preserve mode and ruleset identity in session-integrity metadata;
- ranked creation rejects the mode, and leaderboard eligibility independently
  rejects every explicitly non-classic mode.

The server replaces caller-provided spawn probabilities with the canonical
numeric-only distribution, so a modified browser request cannot introduce
special spawns while retaining numbers-only identity.

## User experience and acceptance

The New Game mode selector includes “Numbers only.” Selecting it displays a
visible note that names the excluded tiles and unranked status. Basic/advanced
help states that scoring and terminal rules are unchanged. Browser coverage
checks selection, the request contract, initial numeric tiles, the active mode
label, and help text. The existing tutorial remains the general rules tutorial;
the mode note explicitly tells players which tutorial special-tile lessons do
not apply to a numbers-only run.

## Regression coverage

- Unit contract: identity, forced spawn distribution, special-tile rejection,
  deterministic merging, scoring, win, and spawning.
- Session contract: export, replay import, recovery metadata, and rejection of
  a forged special-tile export.
- API contract: server-enforced configuration, serialized identity, numeric
  starting grid, and invalid custom-board rejection.
- Ranked contract: explicit leaderboard exclusion.
- Browser contract: accessible selection/help and end-to-end creation request.
