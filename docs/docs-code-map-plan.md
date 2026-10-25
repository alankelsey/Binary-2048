Here's a plan, based on a quick look at the repo. Some facts that shape it:

- The repo has about 670 tracked files. lib/binary2048/ is flat, with about 120 modules and tests next to them. The real groupings only show in filename prefixes (replay-_, store-_,
  ops-_, training-_, session\*).
- There are about 69 routes and pages under app/, plus workers/, about 60 scripts and about 100 docs.
- There is no CLAUDE.md, AGENTS.md or llms.txt yet, so an LLM has no starting point.
- You already use this approach once: docs/v2-phase5-workload-entrypoints.json is checked by workload-entrypoint-inventory.test.ts. The code map should follow the same "JSON
  inventory + test that fails when it drifts" model.

Goal

An LLM should be able to answer "where does X live, what calls it, what tests it?" by reading about 2 small files, not by searching 120 modules.

Design principles

1. Generate it, don't write it by hand. A code map written by hand goes stale within a week. Only the domain names and the flow diagrams are written by hand.
2. JSONL for lookups, UML for shape. JSONL has one record per line, so you can grep or jq it and read part of it. Diagrams give the overall picture.
3. Cheap to read. One-line summaries, no code bodies, and a target total size for each file.
4. Checked in CI, like your existing inventory test.

Layout

AGENTS.md ← starting point (CLAUDE.md just says "see AGENTS.md")
llms.txt ← short public index (the llms.txt convention)
docs/codemap/
README.md ← how to query: grep/jq recipes
domains.json ← HAND-CURATED: domain → prefixes/files, one-line purpose, owner doc
files.jsonl ← one line per source file
symbols.jsonl ← exported functions/types/consts with signatures
edges.jsonl ← internal import graph (from → to)
routes.jsonl ← API route → methods → lib deps → tests → OpenAPI op
docs.jsonl ← index of docs/_.md (title, topic, date, status)
uml/
domains.mmd ← component diagram: domains + their dependencies (generated)
<domain>.mmd ← module-level diagram for each domain (generated)
types.mmd ← class diagram of core types (types.ts etc., generated)
flows/_.mmd ← HAND-WRITTEN sequence diagrams for the key flows

Example files.jsonl line:
{"path":"lib/binary2048/replay-validate.ts","kind":"lib","domain":"replay","summary":"Validates replay move logs against deterministic RNG","exports":["validateReplay","ReplayValidat
ionError"],"imports":["engine","replay-format","rng"],"importedBy":12,"tests":["lib/binary2048/replay-validate.test.ts"],"loc":214,"sha":"a1b2c3d"}

UML choice: Mermaid over PlantUML (my recommendation)

Mermaid shows up directly on GitHub and in your gh-pages site, needs no Java, and LLMs read and write it well. PlantUML has more complete UML, but it adds a toolchain for little
gain. If you need it later, the generator can output .puml too.

Flow diagrams worth writing by hand (these are what the code can't show):

- New game → move → resumable write → session store (deterministic seed + rngStep)
- POST /api/simulate → admission → SQS → research worker → artifact store → jobs/[id]/result
- Replay: record → sign → share code → validate → postmortem
- Bot API key auth → scopes → rate limit → tournament
- Training: replays/labels endpoints → binary2048_pipeline.py

Generator: scripts/codemap.mjs

- Uses the TypeScript compiler API (already installed, no new dependency) to read app/, lib/, workers/, auth.ts and scripts/\*.mjs.
- For each file it extracts the kind (route/page/lib/worker/script/test), exports with signatures, internal imports, HTTP method exports for route.ts, and the matching \*.test.ts.
- Summary source: the first JSDoc or leading comment. If there is none, it marks the file "summary": null, which gives you a to-do list. If you want, an LLM can fill in missing
  summaries later, cached by content hash so unchanged files are never re-summarized.
- Domain assignment comes from the prefix rules in domains.json. A file that matches no rule fails the check, so new modules have to be placed in a domain.
- Links to openapi.ts (route ↔ operationId) and to the existing workload-entrypoints JSON instead of copying it.

Keeping it current

- npm run codemap regenerates everything, and npm run codemap:check regenerates in memory and diffs.
- A Jest test (lib/binary2048/codemap.test.ts) in the same style as the inventory test checks three things: no drift, every file has a domain, and every route has a test.
- Add it to your existing GitHub workflow.

Phases

┌─────┬───────────────────────────────────────────────────────────────────────────────────┬──────────┐
│ # │ Deliverable │ Effort │
├─────┼───────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ 1 │ domains.json (written by hand, about 12–15 domains) + AGENTS.md skeleton │ small │
├─────┼───────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ 2 │ Generator → files.jsonl, edges.jsonl, routes.jsonl + check test │ medium │
├─────┼───────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ 3 │ symbols.jsonl, docs.jsonl, generated Mermaid domain/type diagrams │ medium │
├─────┼───────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ 4 │ The 5 hand-written sequence diagrams + llms.txt + query recipes │ small │
├─────┼───────────────────────────────────────────────────────────────────────────────────┼──────────┤
│ 5 │ Optional: LLM summaries cached by hash, publishing uml/ on gh-pages, .puml output │ optional │
└─────┴───────────────────────────────────────────────────────────────────────────────────┴──────────┘

A side benefit for your research and publication goal: domains.mmd and the flow diagrams can go straight into a JOSS or arXiv paper's architecture section.

Decisions for you

1. Diagram format: Mermaid (recommended) or PlantUML?
2. Summaries: doc comments only (free, deterministic), or LLM-filled gaps too?
3. Scope: include docs/ (about 100 files) and scripts/ from the start, or code only for now?

Once you've answered these, I'd start with phases 1–2. I'll create a branch for it, since you have uncommitted work on main.
