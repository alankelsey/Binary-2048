# V2 Phase 6 conditional rendering decisions

Date: 2026-10-26 America/Boise

Status: complete. Transform-based tile travel and board memoization were
evaluated and intentionally deferred because their declared evidence gates are
not met.

## Transform-based tile travel

The Phase 6 plan permits transform-based travel with stable visual identities
only if user testing shows that it improves comprehension and feel. The
repository contains the original engineering suggestion but no completed user
study, preference test, comprehension result, or physical-device acceptance
showing that source-to-destination travel is better than the current immediate
state update plus destination feedback.

The special-tile optimization also removed the measured transient repaint
cost without changing effect timing or semantics. The final Pixel acceptance
found zero long tasks, preserved reduced-motion behavior, and passed TalkBack.
Adding FLIP-style travel now would introduce identity bookkeeping, new motion,
reconciliation behavior, and another accessibility surface without the product
evidence required by the plan.

Decision: do not implement tile travel in Phase 6. Reopen it as a bounded
prototype only after user testing defines tasks and success criteria, compares
current and candidate behavior on a physical phone, and includes reduced-motion
and screen-reader participants or equivalent accessibility review.

## Board memoization or splitting

The board contains 16 simple DOM cells. The existing performance analysis
rates their reconciliation cost as minor compared with the former network
critical path and explicitly says the board is not evidence for a canvas
rewrite or aggressive memoization. The Phase 6 Pixel work found expensive
paint/raster properties in transient CSS effects and removed those measured
properties; it did not find a React-render bottleneck. Post-change captures had
zero main-thread tasks over 50 ms.

No production React profile in the repository assigns material work to the
board component. Adding memo boundaries or splitting the board without such a
profile would increase component and prop-comparison complexity without a
measured target.

Decision: retain the current accessible DOM grid. Reopen memoization only when
a representative production React profile—covering normal moves, special
tiles, long histories, and support UI state changes—shows material board work
and supplies a before/after acceptance metric.

## Phase 6 disposition

These are evidence-gated no-change decisions, not skipped implementation. With
the Pixel effect optimization, guest-startup measurement, and post-animation
accessibility acceptance already complete, recording these deferrals closes
Phase 6 without speculative rendering work.
