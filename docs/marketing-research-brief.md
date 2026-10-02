# Binary-2048 Marketing Research Brief

Date: 2026-10-01. Status: first pass, desk research only. Companion to
`marketing-launch-plan.md`. No implementation is authorized by this document.

Every external claim below has a source and the date it was checked. Platform
rules change often. Re-check each one in the week before acting on it.

## Summary

1. **The casual 2048 market is crowded.** Themed clones, bigger grids,
   power-ups, hex boards and multiplayer variants already exist across
   CrazyGames, the app stores and itch.io. A casual-first launch competes on
   novelty alone, and "binary" names are already in use.
2. **The bot and research angle is real but contested.** A Gymnasium 2048
   environment already exists on PyPI, and at least three recent LLM game
   benchmarks include 2048 (lmgame-Bench at ICLR 2026, KORGym, Orak). We
   cannot claim "first 2048 environment for AI". Our defensible differences are
   the custom rules, server-side determinism with replay verification, a
   same-seed tournament API and a verified public dataset.
3. **Major web-game portals do not fit the current architecture.** Each move
   calls the same-origin `/api/games` endpoints, while itch.io, Newgrounds,
   CrazyGames and Poki expect an uploaded, self-contained HTML5 zip. Poki also
   requires its SDK, a 16:9 canvas and written consent for third-party
   services. A portal listing would need a separate client-side build.
4. **Hacker News is the strongest single channel for our audience.** Show HN
   rules fit us well: something people can try immediately, with no signup.
   Posting Tuesday to Thursday morning, US time, is the common advice.
5. **Product Hunt is expensive in effort.** Guides describe a maker profile
   that must be active for weeks beforehand, 8–12 visual assets and a full day
   of engagement, and the top spots need hundreds to over a thousand upvotes.
   It is a poor fit for a solo launch without an existing network.
6. **Timing.** NeurIPS runs December 6–13, 2026 across Sydney, Atlanta and
   Paris. This is a good hook for the research angle but a crowded week for AI
   news. Late November into December is also holiday retail season.

**Revised recommendation:** lead the hard launch with the bot and research
audience through Show HN, technical Reddit communities and a Hugging Face
dataset. Treat casual reach as a second wave. Defer game portals until the
owner decides whether a client-side build is worth the scope.

## Q1. Competitive landscape

### Casual 2048 variants

Findings (checked 2026-10-01):

- Common variant patterns are themed tiles (animals, superheroes, food), larger
  grids (5×5 up to 8×8), power-ups and obstacles, hexagonal boards and
  real-time multiplayer. They are distributed through CrazyGames, the mobile
  app stores and itch.io. [search summary of variant listings](https://m-umar.itch.io/2048-plus)
- Existing "binary" titles include Binary Blocks (Windows Store), Binary Chain
  2048 (iOS) and an "11111 Game" built for a binary-themed game jam on itch.io.
  [Binary Blocks](https://apps.microsoft.com/detail/9nblggh07tzs),
  [Binary Chain 2048](https://iphone.apkpure.com/app/binary-chain-2048/com.worldbydesign.binarychain),
  [11111 Game](https://prostolyubo.itch.io/11111game)

Implications:

- "Binary" alone is not distinctive in search. Pair it with the rule twist
  ("zeros annihilate") and the bot angle in titles and metadata.
- Run a trademark and app-store name check before spending on the name in
  assets or merch. This brief does not cover that check.

### Bot and AI environments

Findings (checked 2026-10-01):

- `gymnasium-2048` on PyPI provides a Gymnasium environment with a 4×4×16
  one-hot observation, four actions and merge-value rewards.
  [PyPI](https://pypi.org/project/gymnasium-2048)
- lmgame-Bench evaluates LLMs on six games including 2048 through a Gym-style
  API, and was presented at ICLR 2026.
  [arXiv 2505.15146](https://arxiv.org/html/2505.15146v2),
  [ICLR 2026 poster](https://iclr.cc/virtual/2026/poster/10007223)
- KORGym includes 2048 among more than 50 games for LLM reasoning evaluation.
  [arXiv 2505.14552](https://arxiv.org/pdf/2505.14552)
- Orak includes 2048 and scores normalized progress toward the 2048 tile.
  [arXiv 2506.03610](https://arxiv.org/pdf/2506.03610)
- Papers with Code was shut down on 2025-07-24. Hugging Face's Trending Papers
  is the partial replacement, without the old task leaderboards.
  [Hyper.ai report](https://hyper.ai/en/news/42900)

Implications:

- Position Binary-2048 as **a harder, rule-varied 2048 with a hosted,
  verifiable tournament API**, not as the first 2048 environment.
- Cite lmgame-Bench, KORGym and Orak in research posts. Being honest about
  prior work earns credibility with HN and ML audiences, and running their
  harnesses against our rules is a natural follow-up post.
- A Gymnasium-compatible Python wrapper around our API would lower the barrier
  for RL users. This is a candidate roadmap item, not approved scope.
- Without Papers with Code, discovery for benchmarks runs through Hugging Face
  datasets and Trending Papers, arXiv and social media.

### Claims we can and cannot make

| Claim | Status |
| --- | --- |
| "First 2048 AI environment" | **Do not use.** Contradicted by gymnasium-2048 and the benchmarks above |
| "First LLM benchmark on 2048" | **Do not use.** Contradicted by lmgame-Bench, KORGym and Orak |
| "Deterministic, replay-verifiable 2048 variant with a tournament API" | Plausible; no counterexample found, but phrase it descriptively, not as "first" |
| "Open, checksum-verified dataset of LLM and rollout games" | Supported by `research-release-audit-2026-09-29.md` |
| "Zeros annihilate, wildcards multiply" | A factual rule description; safe to use |

## Q2. Search demand

Not measured in this pass. Free sources need a browser session or Search
Console data that this desk pass did not have.

Next steps for the owner or a later session:

1. Google Trends: compare "2048", "2048 game", "2048 AI", "2048 bot" and
   "binary 2048" over five years, worldwide and United States.
2. Search Console: once production is indexed, export the queries already
   bringing impressions. This is the most reliable free signal we will get.
3. Autocomplete: record suggestions for "2048 a…", "2048 b…" and "2048 with…".
4. Choose one primary casual keyword and one primary developer keyword for
   page titles and the press kit.

## Q3. Communities and their rules

| Community | Rule that matters (checked 2026-10-01) | Fit | Source |
| --- | --- | --- | --- |
| Hacker News, Show HN | Must be something people can try, ideally with no signup; no landing pages or newsletters; must be your own work and you must be around to discuss it; do not ask friends to upvote | Strong: bot API, determinism, playable without an account | [Show HN rules](https://news.ycombinator.com/showhn.html) |
| r/MachineLearning | `[P]` project posts are directed to a recurring self-promotion thread | Medium: post in the thread, or post a substantive `[R]` or `[D]` piece later | [self-promotion thread](https://redlib.hbubli.cc/r/MachineLearning/comments/1l16j5k/d_selfpromotion_thread) |
| r/Games, r/pcgaming (reference norms) | About a 10% self-promotion ratio, and you must be an active member first | Low for a web puzzle; shows typical Reddit norms | [r/Games FAQ](https://axebps-redlib.hf.space/r/Games/wiki/faq), [r/pcgaming policy](https://redlib.belloworld.it/r/pcgaming/wiki/selfpromotion) |
| r/WebGames | Rules not found in this pass; read the sidebar before posting | Likely strong for casual players | — |
| Product Hunt | No asking for upvotes; votes are weighted for integrity; the "Coming Soon" feature has been removed | Weak for a solo launch without a network | [Innmind guide](https://blog.innmind.com/how-to-launch-on-product-hunt-in-2026) |
| Hugging Face Hub | A free account is enough to publish datasets; a dataset card (README) is strongly recommended; Parquet is supported | Strong for the research audience; the dataset is already audited | [HF upload docs](https://huggingface.co/docs/datasets/upload_dataset) |
| JOSS | Requires OSI-licensed open source, an obvious research application, a feature-complete and maintainable design, and a paper focused on the software rather than results | Possible later; requires framing the bot API and harness as research software | [JOSS submitting](https://joss.readthedocs.io/en/latest/submitting.html) |

The common thread is to participate before promoting. HN and Reddit both
penalize accounts that exist only to promote. If the owner's accounts are new
or inactive, start ordinary participation now, during Phase 0.

Still to check: r/WebGames, r/puzzles, r/2048, r/reinforcementlearning,
r/LocalLLaMA, Lobsters (invite-only), and two or three RL and game-AI Discord
servers.

## Q4. Game portals

| Portal | Requirements (checked 2026-10-01) | Fit today | Source |
| --- | --- | --- | --- |
| itch.io | Upload a zip with `index.html` at its root (no more than 1,000 files) or a single HTML file; served in an iframe | Blocked: needs a self-contained build | [itch.io HTML5 docs](https://itch.io/docs/creators/html5) |
| Newgrounds | HTML5 zip with `index.html` at its root; cover art, description and tags; asks about mobile support | Blocked: same reason | [Construct tutorial](https://construct.net/en/tutorials/publish-game-newgrounds-27) |
| CrazyGames | HTML5 build through the developer portal; "Basic Launch" without the SDK to test player response, then SDK integration for "Full Launch" and revenue; initial download no larger than 50 MB (20 MB for the mobile homepage) | Blocked by architecture; otherwise a reasonable low-commitment test | [technical requirements](https://docs.crazygames.com/requirements/technical), [Cinevva guide](https://app.cinevva.com/guides/publish-game-crazygames) |
| Poki | Human review and staged tests; Poki SDK required; 16:9 canvas; must work in incognito; third-party services and tracking need written consent; small initial download | Poor: conflicts with our auth, telemetry and store | [Poki requirements](https://sdk.poki.com/requirements) |

Architecture finding: `app/page.tsx` creates games, moves and undoes through
same-origin `/api/games/*` requests. A portal build would need one of these:

- **Option A: client-side offline build.** Run the deterministic engine in the
  browser. Games would be unranked, have no accounts and no store, and link
  back to binary2048.com for ranked play. This fits our integrity rules and
  works as a funnel.
- **Option B: thin client against our API.** Requires cross-origin access
  (CORS), raises abuse and rate-limit exposure, and portal traffic would hit
  our metered infrastructure.

Option A is the safer candidate and needs owner approval as new scope. Until
then, use itch.io as a **devlog and link page only**, not a hosted game.

## Q5. Timing

| Window | Consideration | Source |
| --- | --- | --- |
| Show HN | Tuesday to Thursday, about 7–10am Pacific Time; avoid weekends and Mondays (common practitioner advice, not an official rule) | [Flowjam playbook](https://www.flowjam.com/blog/how-to-get-on-the-front-page-of-hacker-news-in-2025-the-complete-up-to-date-playbook) |
| NeurIPS 2026 | December 6–13 across Sydney, Atlanta and Paris; good research hook, crowded AI news week | [NeurIPS dates](https://neurips.cc/Conferences/2026/Dates) |
| Late November to December | Thanksgiving and holiday retail season dilute attention; good for the merch angle, weak for developer launches | General knowledge; verify the specific dates |
| V1 gates | Hard launch must wait for persistence and inventory acceptance (see `v1-costed-scope-2026-10-01.md`) | Internal |

Draft calendar for owner review:

- **October:** Phase 0 foundations and community participation
- **Early to mid November:** soft launch to small cohorts; Hugging Face
  dataset published; bot tournament opens
- **Hard launch:** either the first half of December, using NeurIPS as the
  research hook, or mid-January to avoid the holidays. Pick based on V1 status.

## Press kit contents

Based on common indie press-kit guidance
([Game Developer](https://www.gamedeveloper.com/business/presskits-the-what-and-the-why),
[presskit.gg](https://presskit.gg/blog/indie-game-press-kit-guide)). Host it on
our own domain, for example a `/press` page:

- Fact sheet: title, developer, platforms (web), release date, price (free
  with optional cosmetics or subscription), website and repository links
- Short and long descriptions, plus a key-features list
- 6–12 screenshots at 1920×1080 or larger, without watermarks
- A 15–30 second trailer or GIF showing an annihilation chain, a wildcard
  multiply and a bot playing
- Logo files, both light and dark
- A bot-builder section: API quickstart, benchmark table, dataset link
- Contact email

## Changes this brief makes to the launch plan

1. Lead with the bot and research audience. This was a recommendation; this
   brief now supports it.
2. Remove "first" and "only" claims from all drafts, including the Show HN
   draft in `bot-first-launch-package.md`. Add a "prior work" line citing
   gymnasium-2048 and lmgame-Bench.
3. Move game portals from Phase 3 week 2 to "deferred, pending the Option A
   decision". Use itch.io as a devlog and link page only.
4. Product Hunt becomes optional, not a launch-day anchor.
5. The Hugging Face account moves from "nice to have" to a Phase 1 task.
6. New candidate roadmap items for owner approval: a Gymnasium wrapper for the
   API, and a client-side unranked build for portals.

## Open research tasks

- [ ] Search demand: Google Trends, autocomplete, Search Console (Q2)
- [ ] Subreddit and Discord rules still unchecked (Q3)
- [ ] Trademark and name check for "Binary 2048" and the slogans in the merch doc
- [ ] List of 10–20 press and newsletter contacts (indie web games, AI and ML, developer)
- [ ] Five to ten audience conversations during soft launch
- [ ] Re-verify all platform rules within one week of each submission
