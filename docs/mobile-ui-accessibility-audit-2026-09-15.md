# Mobile UI & Accessibility Audit — 2026-09-15

## Scope

Requested via the `frontend-design` plugin skill: review the project for UI
improvements (mobile controls hard to reach/use, game board should dominate
the phone screen with options still reachable), run an accessibility audit,
and propose layouts for an admin panel and a competition/leaderboard view.

This doc records what was **implemented and verified**, what was **found but
left open**, and **specs for work not yet built** (admin panel), so another
session can pick up any thread without re-deriving context.

Branch: worked directly on `main` (repo was clean at session start). No
commits were made — changes are in the working tree as of this writing.

## Files touched

First pass (2026-09-15 morning):

- `app/page.tsx` — mobile action-dock restructuring
- `app/globals.css` — dock CSS, `.button`/`.row`/`.meta-text` utilities,
  leaderboard table styles, reduced-motion block
- `app/leaderboard/page.tsx` — full rewrite (JSON dump → real table UI)
- `lib/binary2048/mobile-layout.test.ts` — updated pinned CSS-guardrail
  strings to match the new dock rules
- `tests/prod/prod.browser.spec.ts` — updated one assertion
  (`"Show Controls"` → `"Options"`)

Continuation session (2026-09-15, later same day — see §6):

- `app/page.tsx`, `app/globals.css` — dock nowrap/ellipsis/`danger-armed`
  robustness fix; difficulty-help disclosure (state, effect, markup, CSS)
- `app/leaderboard/page.tsx` — updated imports after the view-layer split
- `app/leaderboard-view.tsx` (new) — JSX table components
- `lib/binary2048/leaderboard-view.ts` (new) — pure formatting helpers
- `lib/binary2048/leaderboard-view-format.test.ts` (new) — unit tests for
  the formatting helpers above; the distinct basename avoids colliding with
  the component-rendering `.test.tsx` suite under ts-jest
- `lib/binary2048/mobile-layout.test.ts` — two new guardrail assertions
  (safe-area padding rule, danger-armed/nowrap rule)
- `tests/prod/mobile-dock.browser.spec.ts` (new) — 11 tests
- `tests/prod/leaderboard.browser.spec.ts` (new) — 8 tests

Final UI correction pass (2026-09-16 — see §7):

- `tests/ui/mobile-dock.browser.spec.ts` — moved from `tests/prod/` (local UI
  regression test, not a production synthetic; unchanged besides its header
  comment)
- `tests/ui/leaderboard.browser.spec.ts` — moved from `tests/prod/`; header
  comment updated, and its three "populated" tests renamed with a
  `[fixture]` prefix to make clear they exercise injected markup/CSS, not
  the real `RankedTable`/`DailyTable` components
- `tests/ui/difficulty-help.browser.spec.ts` (new) — 7 tests covering the
  difficulty-help disclosure end to end (Options → secondary controls →
  keyboard focus/Enter/Space/click → `aria-expanded`/`aria-controls` →
  Escape → touch tap)
- `playwright.ui.config.ts` (new) — local-only config for `tests/ui`,
  `testDir: "./tests/ui"`, `baseURL` defaults to `http://localhost:3000`;
  `UI_BASE` overrides are rejected unless they use a loopback hostname
- `package.json` — added `test:ui` script (`playwright test -c
  playwright.ui.config.ts`)
- `app/page.tsx` — difficulty-select-wrap markup fix: the help button no
  longer nests inside the `<label>` that also wraps the `<select>`; the
  select now uses `id="difficulty-select"` +
  `aria-labelledby="difficulty-select-label"` instead of relying on label
  wrapping, and the wrapper is a plain `<div>`
- `app/globals.css` — `.difficulty-select-wrap`'s mobile/narrow-width rules
  reworked for the wrap's new three-child layout (label text, help button,
  select) so the help button doesn't drift away from its label text or
  inherit a generic `.options-grid button`'s min-width/flex sizing
- `lib/binary2048/leaderboard-view.test.tsx` (new) — static-renders the real
  `RankedTable`/`DailyTable` components via `react-dom/server`'s
  `renderToStaticMarkup`, asserting on captions, headers, rows, tier
  labels, formatted values, empty states, and player ids
- `jest.config.cjs` — `testMatch` now also matches `**/*.test.tsx`;
  `.tsx` test files compile through the new `tsconfig.jest.json` (see
  below) instead of the project's default `jsx: "preserve"`
- `tsconfig.jest.json` (new) — extends `tsconfig.json`, overrides
  `jsx: "react-jsx"` for test compilation only; the app's own
  `tsconfig.json` (and therefore `npx tsc --noEmit -p .` and the Next.js
  build) is untouched
- `docs/mobile-ui-accessibility-audit-2026-09-15.md` (this file) — marked
  finding #6 fixed, corrected file lists, clarified fixture-vs-component
  test coverage, updated totals (see §7)

Verification run each pass: `npx tsc --noEmit -p .` (clean) and
`npm run test:unit` — 143 suites / 445 tests after the first two passes,
**146 suites / 461 tests after the final correction pass, guest bridge,
recovery-aware export, and browser-action regression coverage**, all
passing. The mobile dock and leaderboard page were also visually verified
with headless Chromium (via Playwright, since `chromium-cli` isn't
installed on this machine) at
390×844 and 1280×900 — screenshots are not committed anywhere, but the
verification steps below reproduce them.

---

## 1. Mobile controls — implemented

### The actual bug

On mobile (`compactMobile`, ≤560px), **all** action buttons — including
**New Game** and **Undo** — were rendered inside a single `.actions` div
that was hidden by default (`mobile-collapsed`) behind a **"Show Controls"**
toggle (`app/page.tsx`, previously ~line 1197). This was specifically an
**active-game control-discoverability problem**, not a first-visit one: the
existing `NewGameOverlay` (the "Start New Game" button shown when
`!state`) already handled the empty/first-visit case correctly and was
never broken. The actual gap was that *after* starting a game, every
control needed to manage that run — New Game, Undo — was hidden behind a
toggle the player had no reason to know existed. This, not board size, was
the primary "hard to access" complaint.

### Fix

Split the single `.actions` container into two tiers (both still carry the
base `.actions` class, so existing shared CSS rules keep applying to both):

- **`.actions-primary`** (`id="game-controls"`): New Game, Undo, Fullscreen,
  and a relabeled **"Options"** button (was "Show/Hide Controls" — renamed
  per the writing guidance that a control's label should say what it does).
  On mobile this becomes a `position: fixed` dock pinned to the bottom of
  the viewport (thumb zone), with a `backdrop-filter: blur` + border-top,
  `env(safe-area-inset-bottom)` padding, and 44px (`2.75rem`) min-height
  buttons — meets the mobile best-practice touch-target size (was ~38px).
- **`.actions-secondary`** (`id="game-controls-more"`): Export/Replay JSON,
  the Options `<details>` panel (difficulty/color/theme/mode/import/export),
  and the dev-only "Dev Controls" panel. Same collapse mechanism as before
  (`mobile-collapsed` class), toggled by the "Options" button in the primary
  dock instead of a detached button above everything.

`main` gets `padding-bottom: calc(4.9rem + env(safe-area-inset-bottom))` on
mobile so the fixed dock never overlaps scrollable content (share row,
"How to play", accessibility hint blocks).

The static tagline paragraph ("Made mostly for bots...") is hidden at
≤560px (`.tagline { display: none; }`) to reclaim vertical space so the
board — now freed from competing with the dock for flow space — fills most
of the screen.

### A real bug caught during verification

While confirming the dock rendered correctly, computed-style inspection
showed the two dock buttons stacked full-width instead of sitting
side-by-side at ≤420px. Cause: an existing rule at the 420px breakpoint,
`.actions > button, .options-grid button { flex: 1 1 100%; }`, matched the
new dock buttons too (same base `.actions` class) and won the cascade by
source order over the newer `.actions-primary > button { flex: 1 1 0; }`
rule defined in the 560px block above it. Fixed by rescoping the 420px rule
to `.actions-secondary > button, .options-grid button` and adding an
explicit `.actions-primary > button` override inside the 420px block so the
primary dock stays a single row at every mobile width. This is the kind of
selector-specificity collision the `frontend-design` skill process warns
about explicitly ("be careful of CSS selector specificities... this can
happen with a type-based selector like `.section` and an element-based
selector like `.cta`") — same shape here with two classes on `.actions`.

### Verification steps (for a future session to re-check)

```bash
npm run dev:once &   # or: NEXT_DIST_DIR=.next-dev npx next dev
# wait for http://localhost:3000 to respond
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.screenshot({ path: '/tmp/mobile-home.png' });
  await b.close();
})();
"
```

Confirmed via this method: dock buttons render side-by-side at 390px width,
board fills the majority of the viewport above the dock, and opening
"Options" during an active game reveals the secondary drawer (Options /
Dev Controls / How to play) in normal document flow above the still-visible
dock, with no clipping.

**This is not a real-device check.** Headless Chromium has no notch, no
home-indicator gesture area, and reports `env(safe-area-inset-*)` as `0px`
regardless of viewport size — it cannot exercise the safe-area padding it's
supposedly protecting, and it can't catch anything specific to Android
Chrome or iOS Safari (viewport units, on-screen-keyboard resize behavior,
momentum-scroll interactions with a `position: fixed` dock, etc.). The
roadmap's "Run and document a real-device mobile UX audit on iPhone +
Android" item is **not satisfied by this or any of this session's
verification** and should stay unchecked until it's actually done on
physical devices.

---

## 2. Competition view (`/leaderboard`) — implemented

### The actual bug

`app/leaderboard/page.tsx` rendered standings as
`<pre>{JSON.stringify(ranked, null, 2)}</pre>` — a raw JSON dump was the
entire UI for both the Ranked and Bitstorm Daily tabs. The tab links also
used `className="button"`, `className="row"`, and `className="meta-text"`,
**none of which are defined anywhere in `globals.css`** — so they rendered
as unstyled default browser links (blue/purple, underlined) against the
dark theme. The same three undefined classes are also used, unstyled, on
`app/auth/page.tsx`, `app/store/page.tsx`, and `app/ghost-race/page.tsx`.

### Fix

- Added `.button`, `.row`, `.meta-text` utility classes to `globals.css`,
  matching the existing pill-button/HUD token system (`--button-bg`,
  `--button-border`, `--card-border`, `--meta-text`). This also fixes the
  same broken styling on `/auth`, `/store`, and `/ghost-race` without
  touching those files.
- Rewrote the leaderboard page: real `<table>` markup per tab (`scope="col"`
  headers, `sr-only` caption), rank column (top-3 get a distinguishing
  color — legitimate since rank *is* a real sequence, not decorative
  numbering), a tier chip reusing the existing `.auth-tier-*` styles, an
  empty state with actual copy instead of an empty array, and
  `aria-current="page"` on the active tab link.
- Added `.leaderboard-table*` CSS: sticky header row, tabular-nums for
  score/moves/max-tile columns, alternating row tint, horizontal scroll
  container on narrow screens.

### A reliability bug caught during verification

Hitting `/leaderboard` in this dev environment 500'd:
`TypeError: Invalid URL` thrown from `getServerSession(authOptions)`
(NextAuth couldn't resolve a URL from the request in this environment —
likely a `NEXTAUTH_URL`/host-header resolution gap, not something this
audit tried to fix). This call is **identical** to what the original file
already had — not a regression from the redesign — but it's a real,
reproducible failure mode. `app/auth-shell.tsx` already has the correct
defensive pattern:

```ts
let session = null;
try {
  session = await getServerSession(authOptions);
} catch {
  session = null;
}
```

Applied the same pattern to `app/leaderboard/page.tsx`. **Correction:**
`app/auth/page.tsx` was checked again and already has this exact try/catch
guard (it does not need the fix). `app/store/page.tsx` and
`app/privacy/page.tsx` do still call `getServerSession` unguarded and carry
the same latent risk of a hard 500 instead of a guest-tier fallback — but
fixing that is **backend session handling, out of scope for this UI-only
session** (per the roadmap's own item: "Add observable, fail-closed
server-session lookup handling for auth-aware pages" is tracked separately
under Product Roadmap, and explicitly calls for logging + fail-closed
semantics for protected actions, not just a bare try/catch). Left as an
open finding below, not applied.

---

## 3. Accessibility audit

| # | Finding | Status |
|---|---|---|
| 1 | Primary controls (New Game/Undo) unreachable on mobile without discovering a hidden-by-default toggle | **Fixed** — see §1 |
| 2 | Touch targets ~38px (`.actions > button` at ≤560px was `min-height: 2.35rem`), under the ~44px mobile best-practice target | **Fixed** for the primary dock (now 2.75rem). Secondary/options-grid buttons remain ~34–38px — still ≥24px (WCAG 2.5.8 AA minimum), just not AAA/44px. Left as-is: lower-frequency actions reached via disclosure, judged an acceptable trade rather than resizing every button in scope. |
| 3 | Leaderboard rendered raw JSON; tab links used undefined CSS classes → no table semantics for screen readers, default unstyled low-contrast links | **Fixed** — see §2 |
| 4 | `getServerSession` uncaught → hard 500 instead of guest fallback (a broken page is maximally inaccessible) | **Fixed** on `/leaderboard`. `/auth` already had this guard (no fix needed — corrected from this doc's first draft, which wrongly listed it as unguarded). **Open** on `/store`, `/privacy` — backend session handling, explicitly out of scope for this UI-only session; tracked on the roadmap under Product Roadmap as its own fail-closed session-handling item, not a bare try/catch. |
| 5 | No `prefers-reduced-motion` support anywhere in `globals.css` — merge/spawn/zero-bust cell animations and the `infinite` win-pulse animation always run | **Fixed** — added a `@media (prefers-reduced-motion: reduce)` block collapsing these to nearly-instant / `animation: none` rather than removing the state-change feedback entirely |
| 6 | Difficulty "?" help affordance (`DIFFICULTY_HELP_TEXT`) is exposed via a `title` attribute on a `<span>`. `title` tooltips don't fire on tap, so sighted touch users have no way to see the help text at all (there's a screen-reader-only path via `aria-label`, but nothing visible for touch) | **Fixed** — replaced with a real `<button aria-expanded aria-controls>` disclosure (§6). A follow-up UI-only pass also corrected the resulting markup: the help button was originally nested inside the same `<label>` that wrapped the `<select>`, which risked the browser's implicit-label click-forwarding activating the select when the button was pressed. Reworked to a plain `<div class="difficulty-select-wrap">` with a `<span id="difficulty-select-label">` + `aria-labelledby` on the `<select>`, and the help button as a sibling, not a label descendant. Covered by `tests/ui/difficulty-help.browser.spec.ts`. |
| 7 | Keyboard focus indication on the new `.button` links | **Fixed incidentally** — `.button:focus-visible` added alongside the other utility classes, so `/leaderboard`, `/auth`, `/store`, `/ghost-race` tab/nav links now get visible focus rings consistent with the rest of the app. |

### Not an issue (checked, ruled out)

- `.meta` text contrast (`--meta-text` on the card background) computes to
  roughly 7.5:1 — comfortably passes AA/AAA for normal text. No finding.
- `main.env(safe-area-inset-*)` handling already existed for the
  fullscreen shell; extended the same pattern to the new fixed dock rather
  than introducing a second approach.

---

## 4. Admin/production ops console — deferred, spec only, not built

**This is explicitly deferred and out of scope to build.** The roadmap says
so directly: "Build a production operations console only after its
authority and data prerequisites exist." What follows is a layout spec for
whenever those prerequisites land — nothing here should be implemented yet.

No admin route exists today. The only "admin" surface is a `NEXT_PUBLIC_UI_ADMIN_MODE=1`
**client env flag** (`lib/binary2048/ui-policy.ts`) that reveals a raw
checkbox grid ("Dev Controls") bolted onto the game page
(`app/page.tsx`, the `UI_POLICY.allOnInDev || UI_POLICY.adminMode` block).

**Prerequisites that don't exist yet (per the roadmap's own Platform + Ops
and Product Roadmap sections — not this audit's invention):**

- An explicit server-verified admin role/claim or allowlist. Account tier
  (`guest`/`authed`/`paid`) must not grant admin access, and the current
  `NEXT_PUBLIC_UI_ADMIN_MODE` flag is baked into the public client JS
  bundle — not an auth check, and not a foundation to build on.
- Authorized, read-only shared ops APIs. None of the sections below have
  one today: `league-config.ts`, `feature-gating.ts`, `ops-telemetry.ts`,
  and `leaderboard.ts` are all **per-instance in-memory state**
  (`globalThis.__binary2048_*` module singletons), not shared/durable
  across instances — an ops UI reading them directly would show one
  instance's view, not the fleet's.
- A real separation between passive health reads and active writes. The
  existing `/api/ops/storage/health` route is not a passive read: it
  creates a real session, applies a real move, and builds a real run
  record as a "smoke write" on every call. Surfacing that in a read-only
  ops panel without making the distinction obvious would be misleading —
  the roadmap calls this out explicitly ("keep active storage smoke writes
  separate from passive health/status reads").

### Proposed IA (ops-console pattern — reuses existing HUD chrome: dark
panel, pill nav, glow accents from `dev-nav`/`.card`/`.button`)

```
┌──────────────────────────────────────────────────────────────┐
│ Binary 2048 · Ops                        [prod ▾] [sandbox]   │
├───────────────┬────────────────────────────────────────────  │
│ ▸ Overview     │  Route health (last 24h)                    │
│ ▸ League       │  ┌────────┬────────┬────────┬─────────┐     │
│   Config       │  │ Route  │ Calls  │ Errors │ p95 ms  │     │
│ ▸ Feature      │  ├────────┼────────┼────────┼─────────┤     │
│   Flags        │  │ /move  │ 12,403 │  0.2%  │   38    │     │
│ ▸ Telemetry    │  │ /games │  1,204 │  0.0%  │   61    │     │
│ ▸ Leaderboard  │  └────────┴────────┴────────┴─────────┘     │
│   Ops          │                                              │
│ ▸ Storage      │  Storage: ● Mongo connected                  │
│   Health       │  League (prod): ruleset v1 · undo=0 ·        │
│ ▸ Model        │              seeds=prod-seeds                │
│   Registry     │                                              │
└───────────────┴────────────────────────────────────────────  ┘
```

Sections map onto existing lib modules for logic, but **every one of them
needs the authorized read-only ops API layer described above first** — the
UI should never call these modules' in-process functions directly from a
route handler reachable by a browser without that gate in front of it:

| Section | Backing module | Data durability today |
|---|---|---|
| Route health / Telemetry | `lib/binary2048/ops-telemetry.ts` | Per-instance memory |
| League Config | `lib/binary2048/league-config.ts` | Per-instance memory |
| Feature Flags | `lib/binary2048/feature-gating.ts` | Static table, not stored state |
| Storage Health | `app/api/ops/storage/health/route.ts` | Performs a real write (smoke test), not a passive read |
| Leaderboard Ops | `lib/binary2048/leaderboard.ts`, `lib/binary2048/tournament-queue.ts` | Per-instance memory |
| Model Registry | `lib/binary2048/model-registry.ts` | Per-instance memory |

On mobile, the left rail collapses into a horizontal pill tab-strip (same
treatment as `.dev-nav-links`), sections stack vertically.

**Not built, and not next.** Standing this up requires, in order: (1) the
admin role/claim decision, (2) shared read-only ops APIs that don't leak
per-instance-only state as if it were fleet-wide truth, (3) then the UI
above. This is a layout reference for when that sequence is ready — this
audit does not recommend starting on it now.

---

## 5. Suggested follow-ups (as of the first pass, 2026-09-15 morning)

1. ~~Replace the `title`-only difficulty help affordance with something
   touch-reachable~~ — **done, see §6 below.**
2. Backend session handling for `/store` and `/privacy` (`getServerSession`
   uncaught) — **explicitly out of scope for this UI-focused work.**
   Tracked on the roadmap as its own fail-closed, logged server-session
   item under Product Roadmap; not a bare try/catch to bolt on casually.
3. Build the admin/ops console per the spec in §4 — **deferred**, not
   started, and not recommended until its own prerequisites (role/claim,
   shared read-only ops APIs) exist. See §4.
4. Leaderboard enhancements once player-identity plumbing exists: a
   "your rank" sticky highlight row, and real pagination instead of a
   fixed `limit` query param — **still not started, still correctly
   deferred** (see §6's leaderboard section for what *was* done this pass).
5. Consider bumping secondary/options-grid button heights toward 44px if
   mobile usage data shows mis-taps there too (currently ~34–38px, AA-
   compliant but not AAA) — **still open.**
6. Run the real Android Chrome / iPhone Safari UX audit — **still open,
   still not satisfied by any headless verification in this doc.**

---

## 6. Continuation session — 2026-09-15, later same day

Scope: finish and validate the mobile action dock, add real Playwright
coverage (not just CSS substring tests), finish the leaderboard
presentation with coverage, and replace the title-only difficulty help —
UI/accessibility/responsive/test work only, no backend/auth/persistence
changes. Full detail of what changed, what was verified, and how, is in
this session's final report to the user; this section is the durable
summary for another session reading this file cold.

### What changed

- **Mobile dock robustness.** The armed **"Confirm New Game"** label (the
  longest string the dock ever renders, and the safety-critical one) could
  wrap to two lines inside its pill depending on font metrics, and a
  pre-existing 420px-breakpoint rule (`.actions > button { flex: 1 1 100%
  }`) could steal the dock's single-row layout entirely. Fixed by giving
  `.actions-primary > button` `white-space: nowrap` +
  `text-overflow: ellipsis` + `min-width: 0` (so the dock is always exactly
  one fixed-height row, never wraps and grows over the board), extra
  `flex-grow` specifically on `.danger-armed` (the confirm button) so it
  never needs to truncate even in the narrowest tested viewport, and
  rescoped the 420px rule to `.actions-secondary` only. Verified
  empirically (not guessed) via headless-Chromium `getBoundingClientRect`/
  `scrollWidth` measurements at 390×844 and 412×915, including the
  combined worst case (confirm-armed + fullscreen-active + options-open
  simultaneously).
- **Difficulty help disclosure.** Replaced the `title`-only "?" span with a
  real `<button aria-expanded aria-controls>` disclosure that shows/hides
  a visible note (`role="note"`), closes on re-toggle or Escape, works with
  touch/keyboard/screen readers, and stays compact (a small inline note
  row, not a modal).
- **Leaderboard presentation.** Extracted the pure, JSX-free formatting
  helpers (`rankClass`, `formatSubmittedAt`, `shortPlayerId`, `TIER_LABEL`)
  into `lib/binary2048/leaderboard-view.ts` with direct unit tests — this
  repo's Jest config (`jsx: "preserve"`, no Babel/SWC transform wired in)
  cannot parse any `.tsx` file, confirmed empirically, so pure logic has to
  live in plain `.ts` to be unit-testable here. The JSX table components
  moved to `app/leaderboard-view.tsx` (mirroring the existing
  `app/game-overlays.tsx` split-out-from-page-component pattern).
- **Playwright coverage** — `tests/prod/mobile-dock.browser.spec.ts` (11
  tests) and `tests/prod/leaderboard.browser.spec.ts` (8 tests), both using
  this repo's existing `page.route` + `applyMove`/`createGame` mocking
  convention. See the header comment in each file for exactly what's
  covered and, for the leaderboard "populated" tests, a documented
  explanation of why they inject fixture markup rather than driving a real
  ranked-leaderboard submission (that path requires real auth + a real
  ranked session — out of scope here). **Superseded, see §7:** this
  paragraph originally also claimed this repo's tooling couldn't
  static-render the real JSX components out of process at all. That was
  true only for the *default* Jest/tsconfig setup (`jsx: "preserve"`, no
  transform); §7 adds a test-only `tsconfig.jest.json` override and gets
  real component-rendering coverage for `RankedTable`/`DailyTable`. The
  fixture tests remain, but now for a narrower, accurately-scoped reason
  (layout/CSS, not "no other option existed").

### Corrections to this doc's first pass

- §1 originally implied first-time/empty-game visits were affected. They
  were not — `NewGameOverlay` already handled that correctly. The dock fix
  was specifically about **active-game** control discoverability.
- §2/§3 originally listed `app/auth/page.tsx` alongside `/store` and
  `/privacy` as unguarded against `getServerSession` throwing. Re-checked:
  `/auth` already has the exact same try/catch guard `/leaderboard` got.
  Only `/store` and `/privacy` are actually unguarded, and fixing them is
  backend session-handling work this UI session did not do.
- §4 originally read as a ready-to-build spec. It is **deferred** — the
  roadmap is explicit that the ops console comes only after its own
  prerequisites (admin role/claim, shared read-only ops APIs) exist, none
  of which exist today. Added the missing caveats: `league-config.ts`,
  `feature-gating.ts`, `ops-telemetry.ts`, and `leaderboard.ts` are all
  per-instance in-memory state, not fleet-wide truth, and
  `/api/ops/storage/health` performs a real write on every call rather
  than a passive read.
- Headless-Chromium verification (in this doc and in the continuation
  session) is not a substitute for the roadmap's real-device Android
  Chrome / iPhone Safari audit item, which remains open and unchecked.

---

## 7. Final UI correction pass — 2026-09-16

Scope: a UI-only correction pass over §6's work — no auth/API/persistence/
Mongo/game-engine/ops-console changes. Four things, in order:

### 7.1 Separated local UI tests from production synthetics

`tests/prod/mobile-dock.browser.spec.ts` and
`tests/prod/leaderboard.browser.spec.ts` mock every API response (or, for
leaderboard's "populated" tests, inject fixture markup) — they were never
production synthetics and running them against the live site would tell
you nothing about production while risking fixture traffic against it.
Moved both to `tests/ui/`, added `playwright.ui.config.ts`
(`testDir: "./tests/ui"`, `baseURL` defaults to `http://localhost:3000`,
with non-loopback `UI_BASE` values rejected) and a `test:ui` npm script.
`playwright.prod.config.ts` still points only at `tests/prod/`
(`prod.browser.spec.ts`, `rapid-input.browser.spec.ts`,
`special-tiles.browser.spec.ts` — unmoved, they're real page-and-engine
checks safe to run against a live instance). `.github/workflows/prod-browser-synthetic.yml`
runs `npm run ops:prod:browser`, which is exactly `playwright test -c
playwright.prod.config.ts` — since that config's `testDir` never included
`tests/ui`, the workflow was already incapable of discovering the moved
specs before this change landed, and remains so now (confirmed by reading
the workflow and both configs, not assumed).

### 7.2 Fixed the difficulty-help markup

The disclosure button added in §6 was nested inside the same `<label>`
that wrapped the `<select>` it sat next to
(`<label><span>Difficulty<button.../></span><select/></label>`). A
`<label>` implicitly associated with a control forwards clicks on the
label to that control; nesting a second interactive element (the help
button) inside it is exactly the shape that risk applies to, even though
it happened not to visibly misfire in manual testing. Fixed in
`app/page.tsx`: the wrapper is now a plain `<div className="difficulty-select-wrap">`;
the visible "Difficulty" text is a `<span id="difficulty-select-label">`
(no longer a `<label>`); the `<select>` gets
`aria-labelledby="difficulty-select-label"` (replacing its old, redundant
`aria-label="Wildcard spawn mode"`); and the help `<button>` is a plain
sibling, not a label descendant. `aria-expanded`, `aria-controls`, the
visible `role="note"` help text, keyboard activation (Enter/Space),
Escape-to-dismiss, and touch/tap all carried over unchanged from §6.

This restructuring changed the wrap from two flex children (a label-text
span containing the button, and the select) to three direct children
(label span, button, select). That surfaced a real, verified regression:
`.options-grid button`'s narrow-viewport rules (`min-width`, `flex`) are a
descendant selector, so they already matched the help button before this
change too, but its previous flex container was the tiny inner label span
(negligible effect); with the button now a direct child of the row-width
`difficulty-select-wrap`, the same rules inflated it to roughly 50% of the
row's width instead of staying a small circle, confirmed by measuring its
`boundingBox()` in headless Chromium before and after. Fixed with a
`.difficulty-select-wrap > .field-help` override (two-class specificity
beats `.options-grid button` at every breakpoint) plus a reworked
narrow-viewport rule for `.difficulty-select-wrap` itself (`justify-content:
flex-start` + `margin-left: auto` on the select, instead of
`justify-content: space-between` across three items, which would have
visually separated the "?" button from the "Difficulty" text it
annotates). Re-verified empirically at 390/412/650px: the button renders
as a fixed 24×24 circle, snug against its label, with the select filling
the remaining row width, at every width tested.

### 7.3 Added `tests/ui/difficulty-help.browser.spec.ts` (7 tests)

Covers: Options → secondary controls → the inner Options `<details>` →
difficulty select + help button visible; keyboard focus reaching the help
button; Enter and Space both opening the note and flipping
`aria-expanded`; click opening the note with the visible text associated
through `aria-controls` (and the accessible name flipping to "Hide
difficulty help"); Escape closing it and returning `aria-expanded` to
`false`; a touch-tap (`dispatchEvent("click")`) opening it; and a direct
assertion that the select has an explicit `aria-labelledby` and that no
`<label>` wraps the help button. Uses the same `page.route` +
`applyMove`/`createGame` mocking convention as
`tests/ui/mobile-dock.browser.spec.ts`. Note: the difficulty options panel
only renders before the first move (`lib/binary2048/control-visibility.ts`:
`showOptionsPanel` is `!isActiveRun`, and a run becomes active once
`turn > 0`) — after a move it's replaced by Export/Replay buttons — so
these tests never make a move.

### 7.4 Real component-rendering coverage for the leaderboard tables

§6 concluded static-rendering the real `RankedTable`/`DailyTable` JSX was
blocked outright by this repo's tooling (`jsx: "preserve"`, no
Babel/SWC/react-jsx transform wired into `ts-jest`) and fell back entirely
to fixture markup injected into a real page. That conclusion was too
strong: the *default* tsconfig can't do it, but ts-jest can be pointed at
a different tsconfig for compilation. Added `tsconfig.jest.json`
(`extends: "./tsconfig.json"`, overrides `jsx: "react-jsx"`) and wired it
into `jest.config.cjs`'s `transform` for `.ts`/`.tsx`, with `testMatch`
extended to also match `**/*.test.tsx`. The project's own `tsconfig.json`
— and therefore `npx tsc --noEmit -p .` and the Next.js build itself —
is untouched; only Jest's test compilation uses the override.

`lib/binary2048/leaderboard-view.test.tsx` (new) imports the real
`RankedTable`/`DailyTable` from `app/leaderboard-view.tsx` and renders them
with `react-dom/server`'s `renderToStaticMarkup`, asserting on the actual
emitted markup: the `sr-only` captions, all six column headers, rank
classing/labels for the top 3 rows, tier labels (`Guest`/`Player`/`Pro`),
`toLocaleString`-formatted score/max-tile/moves, `formatSubmittedAt`
timestamps, both components' empty states, and both the untouched-short
and truncated-long player-id paths (`RankedTable` via the tier chip,
`DailyTable` via its bare id column).

`tests/ui/leaderboard.browser.spec.ts`'s three "populated" tests are
**not** replaced by this — they're kept, but re-scoped and relabeled
(`[fixture] ...`, plus an updated header comment) to say clearly what they
actually test: injected markup exercising the real stylesheet's
layout/CSS (notably horizontal-overflow behavior on narrow screens), not
the real component's render output. That is now
`lib/binary2048/leaderboard-view.test.tsx`'s job. If
`app/leaderboard-view.tsx`'s markup contract changes, the fixture strings
in the browser spec still need manual updating to match — that risk didn't
go away, but it's no longer being asked to also stand in for component
coverage it was never actually exercising.

### Verification

- `git diff --check` — clean.
- `npx tsc --noEmit -p .` — clean (uses the project's own `tsconfig.json`,
  unaffected by `tsconfig.jest.json`).
- `npm run test:unit` — **146 suites / 461 tests, all passing** (up from
  143/445; the new count is `lib/binary2048/leaderboard-view.test.tsx`'s 4
  tests plus its 1 suite, and there were no losses elsewhere).
- `npm run test:ui` (`tests/ui/*`, against a local dev server) — **30
  tests, all passing**: 15 mobile-dock + 8 leaderboard (3 relabeled
  `[fixture]`) + 7 new difficulty-help.
- Confirmed `playwright.prod.config.ts`'s `testDir` is `./tests/prod` and
  does not include `tests/ui`, by reading the config directly (not
  inferred) — the production synthetic workflow cannot discover the local
  UI suite.
- No changes to auth, APIs, persistence, Mongo, game-engine behavior, or
  the production ops-console plan (§4, still deferred, still spec-only).
