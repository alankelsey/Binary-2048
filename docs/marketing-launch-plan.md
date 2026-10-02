# Binary-2048 Marketing and Launch Plan

Date: 2026-10-01. Status: planning draft for exploration. No implementation is
authorized by this document.

## Purpose

The roadmap's completed "Marketing rollout hooks" item covers in-product
plumbing only: share CTAs, referral links, UTM tags and marketing events. This
document adds the missing layer: research, positioning, channels, a soft and
hard launch sequence, and how to measure whether any of it works.

It builds on existing documents rather than replacing them:

- `bot-first-launch-package.md`: Show HN and Reddit drafts for the bot audience
- `content-and-community-ops.md`: blog pipeline, editorial guardrails, community voting
- `telemetry-seo-learning-plan.md` and `event-taxonomy.md`: funnel events and SEO baseline
- `experimentation-framework.md`: A/B testing for landing copy and CTAs
- `merch-and-swag-strategy.md`: physical merch, kept separate from the game economy
- `monetization-targets.md` and `v1-costed-scope-2026-10-01.md`: budget reality
- `research-release-audit-2026-09-29.md`: the public dataset as a launch asset

## Constraints that shape the plan

- **Budget.** Infrastructure runs about $40/month with an approved ceiling near
  $46. The plan is organic-first, and any paid spend is a separate owner decision.
- **Team size.** This is effectively one developer plus Claude. Every channel
  has an ongoing cost in attention, so we pick a few and do them well.
- **V1 gates.** Hard launch must not happen until the V1 persistence, inventory
  and ops gates are accepted. A traffic spike against in-memory sessions would
  lose games, and a bad first impression is hard to undo.
- **Policies already in force.** Rewards stay cosmetic and non-competitive.
  Telemetry stays PII-minimized. Content stays politically and religiously
  neutral. Bot traffic is governed by the abuse playbook and rate-limit matrix.

## What we are marketing

### One-line positioning (draft, to test)

> 2048, rebuilt in binary: zeros annihilate, wildcards multiply, and every game
> is a reproducible seed that you, or your bot, can replay and beat.

### Three audiences, three different pitches

| Audience | What they care about | Hook | Primary call to action |
| --- | --- | --- | --- |
| Casual puzzle players | Quick fun, a fresh twist on something familiar, sharing scores | New rules (`0` annihilates, `1+1=2`, wildcards), daily seed, share cards | Play now, beat today's seed |
| Bot and AI builders | A clean, deterministic environment with an API | Encoded state, action masks, `/api/simulate`, same-seed tournaments | Bring your bot, post a benchmark |
| ML researchers and educators | Reproducible benchmarks and open data | Deterministic seeds, verified public dataset, LLM and RL baselines | Cite, reproduce, extend |

The casual audience gives volume. The bot and research audiences give
credibility, backlinks and long-tail interest, and they are the real
differentiator. Most 2048 clones cannot say "for bots, by bots."

### Differentiators to verify before claiming

Each of these must be confirmed by the market research below before it appears
in copy: "first deterministic 2048 with a bot API", "verified open dataset" and
any "only" or "first" phrasing. Unverified superlatives are the fastest way to
lose a Hacker News thread.

## Workstream 1: Market research

Goal: a short research brief (`docs/marketing-research-brief.md`) that turns
assumptions into evidence before we spend effort on channels.

### Questions to answer

1. **Competitive landscape.** Which 2048 variants are popular now, where are they
   hosted, and what made the breakout ones spread? Which game-AI environments
   (Gymnasium-style environments, Kaggle simulations, bot arenas) does our bot
   audience already use, and what gaps do they complain about?
2. **Search demand.** Which terms have volume and weak competition? Candidates
   include "2048 variant", "binary 2048", "2048 bot", "2048 AI", "2048 API",
   "puzzle game benchmark" and "LLM game benchmark". Use free tools first: Google
   Trends, Search Console data once indexed, and autocomplete scraping by hand.
3. **Communities.** Where do each audience's people gather, what are each
   community's self-promotion rules, and what posts have done well there before?
4. **Listing portals.** What does each web-game portal require (SDKs, ads
   integration, exclusivity, revenue share, technical limits), and does any of
   that conflict with our ad and monetization policies?
5. **Timing.** Which weeks to avoid (major game releases, holidays, big AI news
   cycles), and whether any events (game jams, AI conferences, back-to-school
   for educators) give us a natural hook.

### Method

- Desk research only. No paid tools until the free ones prove insufficient.
- Record a source and date for every factual claim in the brief.
- Run five to ten short conversations or feedback sessions with real people
  from each audience during soft launch. Their language becomes our copy.

## Workstream 2: Channel inventory

Every entry below is a candidate. Submission rules, fees and audience fit must
be verified during research and recorded in the brief. Rules on these sites
change often.

### Game listing sites and portals

| Channel | Audience fit | Notes to verify |
| --- | --- | --- |
| itch.io | Indie and web game players, developers | Free HTML5 listing; may need an embeddable or linked build; devlog feature useful for pre-launch |
| Newgrounds | Web game players | Community-voted; check HTML5 hosting rules |
| CrazyGames, Poki, GameDistribution and similar portals | High casual volume | Often require their SDK, ad integration or exclusivity; may conflict with our ad policy and integrity rules |
| Kongregate, Armor Games and other legacy portals | Smaller now | Confirm whether they still accept new submissions |
| AlternativeTo, Slant and similar directories | Search long tail | Cheap backlinks; list as an alternative to 2048 |
| Product Hunt | Tech early adopters | One-shot launch day; needs prepared assets and a supporter network |

The iframe and static-mirror decision in `github-pages.md` matters here. Portals
that require embedding will run into our `X-Frame-Options` and CSP choices. A
portal-specific build may be required, and that is a scope decision for the
owner.

### Developer, AI and research channels

| Channel | Audience | Notes |
| --- | --- | --- |
| Hacker News (Show HN) | Developers | Draft exists in `bot-first-launch-package.md`; one shot, so make it count |
| Lobsters | Developers | Invite-only community; needs an existing member |
| Reddit: r/WebGames, r/puzzles, r/2048 (confirm it exists), r/programming, r/MachineLearning (`[P]` posts), r/reinforcementlearning, r/LocalLLaMA (Ollama bot angle) | Mixed | Each subreddit has its own self-promotion ratio; read the rules first |
| dev.to, Hashnode, Medium | Developers | Cross-post technical blog posts with canonical links back to us |
| Discord servers for RL, game AI and indie games | Builders | Participate before promoting |
| arXiv, JOSS | Researchers | Long lead time; a paper is a launch asset, not a launch-week task |
| Hugging Face datasets and Spaces | ML community | Blocked until the owner creates an account; worth doing before hard launch |
| Kaggle datasets | ML learners | Possible mirror of the public dataset |

### Social media

| Platform | Content type | Role |
| --- | --- | --- |
| X | Short clips, bot-versus-human results, devlog threads | Dev and AI audience |
| Bluesky, Mastodon | Same devlog content | Developer audience that has moved off X |
| LinkedIn | Build-in-public posts, research angle | Professional network; the owner's 20-year IT background is an asset |
| TikTok, YouTube Shorts, Instagram Reels | 15–30 second gameplay clips: big wildcard combos, near-losses, a bot playing at speed | Casual reach; highest upside, most effort |
| YouTube (long form) | "I built a game for bots" devlog, bot tutorial | Evergreen search traffic |

Recommendation: pick **one casual video platform plus one developer platform**
for the first 90 days rather than posting everywhere thinly.

### Press and newsletters

- Indie game press and blogs that cover web or puzzle games (build a list of 10–20 during research)
- AI and ML newsletters that feature open tools and datasets
- Developer newsletters that run "cool projects" sections
- A press kit page is required before any outreach (see assets below)

## Workstream 3: Hype and anticipation mechanics

These reuse existing systems where possible. Anything that needs new code goes
on the roadmap as a separate, approved item.

- **Waitlist or early-access list.** Capture email with explicit consent. This
  needs a privacy page update and the user data export and delete path.
- **Founding player badge.** Cosmetic only, never ranked advantage, consistent
  with the merch and economy separation rules.
- **Daily seed challenge.** Everyone gets the same seed, and the result is
  shareable. Determinism makes this cheap and cheat-resistant.
- **Beat the bot.** A share card that compares the player's score with a named
  bot on the same seed. This bridges the casual and bot audiences.
- **Launch bot tournament.** Open submissions for two to four weeks before hard
  launch, then announce results on launch day. This gives the bot audience a
  reason to show up early and gives us launch-day content.
- **Devlog cadence.** Weekly short posts through `content-and-community-ops.md`
  during pre-launch.
- **Merch drop.** A small sticker or tee capsule timed to hard launch, optional
  and owner-gated.

## Workstream 4: Phased rollout

Each phase has entry gates and exit signals. Dates are relative. The owner sets
the hard launch date once the V1 gates are close.

### Phase 0: Foundations (now, about 2–4 weeks)

- Finish the market research brief
- Lock positioning and the three audience pitches
- Claim handles on the chosen platforms, even ones we will not use yet
- Verify the SEO baseline, OpenGraph cards and Search Console indexing in production
- Define the UTM convention (below) and confirm marketing events land in telemetry
- Build the press kit: logo, screenshots, a 15-second GIF, a one-paragraph and a
  one-page description, a fact sheet and a contact address

Exit: research brief reviewed, channel shortlist approved by the owner.

### Phase 1: Pre-launch anticipation (about T−6 to T−2 weeks)

- Weekly devlog posts and clips on the shortlisted platforms
- Open the waitlist (if approved) and the launch bot tournament
- Participate genuinely in target communities without promoting yet
- Seed the bot audience: post the API quickstart and benchmark tables to one or
  two technical communities

Exit: a measurable waitlist or follower baseline, plus at least a few external
bot submissions.

### Phase 2: Soft launch (about T−4 to T−1 weeks, overlaps Phase 1)

- Invite small cohorts: waitlist, friends, bot builders, one or two small communities
- List on low-stakes channels first (itch.io, directories)
- Watch the funnel dashboards and friction analysis; fix the top drop-off points
- Run the load-test runbook at expected launch traffic multiplied by a safety factor
- Rehearse the bot-abuse playbook and confirm WAF rate limits suit a spike
- Collect quotes and feedback for launch copy

Entry gate: V1 session persistence accepted. Soft launch on in-memory sessions
is acceptable only if cohorts stay small.

Exit (go/no-go for hard launch): first-session activation and next-day return
are stable or improving; no open P0 or P1 bugs; load test passed; owner sign-off.

### Phase 3: Hard launch (launch week)

Stagger the big one-shot channels so each gets attention and a bad day on one
does not sink all of them:

| Day | Action |
| --- | --- |
| Day 1 (Tue–Thu) | Product Hunt launch; tournament results announced; email waitlist |
| Day 2 | Show HN (bot and determinism angle) |
| Day 3 | Reddit posts to the two or three best-fit subreddits, spaced out |
| Day 4–5 | Social clips, LinkedIn post, press and newsletter follow-ups |
| Week 2 | Portal submissions, technical blog cross-posts, dataset announcements |

During launch week the owner, or a session, monitors comments and ops alarms
daily, and the response playbook for bugs and incidents is ready in advance.

### Phase 4: Sustain (ongoing)

- Weekly daily-seed highlights and bot leaderboard updates
- Monthly tournament or "tile of the week" event (see the content ops doc)
- Monthly blog post on the technical, math or AI-strategy angle
- Quarterly review: drop channels that do not convert, double down on ones that do
- Research track: arXiv or JOSS paper and the Hugging Face dataset release as
  second-wave launch moments

## Measurement

### UTM convention

`utm_source=<platform>&utm_medium=<organic|social|listing|email|press>&utm_campaign=<phase>-<yyyymm>&utm_content=<asset-id>`

For example: `utm_source=hn&utm_medium=organic&utm_campaign=hardlaunch-202611&utm_content=showhn`.
This extends the referral-aware share links that already exist.

### Funnel (from existing telemetry)

`landing_view` → `game_created` → first `move_submitted` → `game_over` →
`social_share_clicked` or `replay_share_clicked` → next-day return →
`auth_signin_success` → `purchase_success`.

For the bot audience, track API key or first `/api/simulate` use, then
tournament submission.

### Targets

Treat these as hypotheses to set after soft launch baselines exist, not
commitments:

- Per channel: visitors, activation rate and cost (time spent)
- Launch week: total new players, share rate, bot submissions
- 30 days after: retained weekly players, organic search share, progress toward
  the $180/month break-even target in `monetization-targets.md`

## Budget

| Item | Baseline | Optional (owner decision) |
| --- | --- | --- |
| Research, content, community | $0 (time only) | — |
| Listings and directories | $0 | Featured placements |
| Press kit and video | $0 (screen capture, existing art) | Freelance trailer edit |
| Paid acquisition test | $0 | Small capped test, e.g. $50–100, only after soft launch shows retention |
| Merch capsule | $0 | Print-on-demand, no inventory |
| Infrastructure headroom for launch spike | Within the approved V1 envelope | Temporary scaling if the load test says so |

Paid acquisition before retention is proven mostly buys players who leave.

## Risks

| Risk | Mitigation |
| --- | --- |
| Launching before V1 persistence lands | Hard gate in Phase 2 and 3 |
| "Just another 2048 clone" reaction | Lead with the binary rules and bot API; show, do not tell |
| Self-promotion bans on Reddit or Discord | Read rules, participate first, one post per community |
| Traffic spike or bot abuse | Load test, WAF rate limits, abuse playbook rehearsal |
| Portal SDK or ads requirements conflict with our policies | Research before committing; skip portals that conflict |
| Owner burnout from too many channels | Two-platform rule for the first 90 days |
| Overclaiming ("first", "only") | Verification step in the research brief |

## Open decisions for the owner

1. Which audience leads the hard launch: casual players or bot builders? The
   recommendation is bot builders for credibility (HN, Reddit ML), then casual
   reach in week 2.
2. Whether to run a waitlist, which adds email handling and privacy obligations.
3. Whether to pursue embed-based game portals, which need a portal-specific build.
4. Which two social platforms to commit to for the first 90 days.
5. Whether to create a Hugging Face account before hard launch.
6. Target hard launch window, set once V1 gates are near completion.
7. Any paid budget at all, and its cap.

## Next exploration steps (no implementation)

1. Write `docs/marketing-research-brief.md` covering the five research questions.
2. Verify listing-site and subreddit rules and record them in the channel tables.
3. Draft the press kit content list and the positioning variants for A/B testing.
4. Bring the open decisions above to the owner and record their answers here.
5. Turn approved items into roadmap tasks with their own scope and acceptance.
