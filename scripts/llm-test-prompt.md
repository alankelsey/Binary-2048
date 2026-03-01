# LLM Test Generation Template

Use this prompt to generate candidate tests for Binary-2048.

## Context
- Repo: Binary-2048 (Next.js + TypeScript)
- Test frameworks:
  - Unit: Jest (`npm run test:unit`)
  - Integration smoke: shell scripts (`npm run test:dev`, `npm run build`)
- Important modules:
  - `lib/binary2048/engine.ts`
  - `lib/binary2048/sessions.ts`
  - API routes under `app/api/**`

## Instructions for the LLM
1. Generate tests only. Do not modify production logic.
2. Focus on edge cases, regressions, and invariants.
3. Prefer deterministic fixtures (fixed seed/config).
4. For each test, include:
   - Why it matters
   - Input/setup
   - Expected output/assertions
5. Keep tests isolated and readable.
6. If a behavior is ambiguous, state the assumption in a test comment.

## Output Format
1. `### Proposed tests`
2. Bulleted list of test cases with rationale.
3. `### Test code`
4. Complete `.test.ts` blocks only.
5. `### Gaps / risks`
6. Any areas the LLM could not confidently cover.

## Current Feature Areas to Target
- Zero tile rules:
  - zero remains when no collision
  - zero + wildcard removes both
- Move counter behavior:
  - turn increments only when board changes
- Replay/export/import consistency
- API error handling for malformed payloads

## Example Prompt
```
Generate Jest tests for `lib/binary2048/engine.ts`.
Focus on zero/wildcard collision rules, noop move behavior, and deterministic replay invariants.
Do not change app code; return only test code and rationale.
```

## Validation Checklist (after generation)
1. Save generated tests in `*.test.ts`.
2. Run:
   - `npm run test:unit`
   - `npm run test:dev`
   - `npm run build`
3. Reject tests that are flaky or rely on hidden state.
