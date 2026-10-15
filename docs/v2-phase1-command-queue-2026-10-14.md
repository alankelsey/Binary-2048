# V2 Phase 1 unified command queue

Date: 2026-10-14

Status: the first Phase 1 item is implemented and locally accepted. Phase 1 is
not complete, and physical Pixel acceptance remains open.

## Behavior

During normal gameplay, keyboard directions, recognized board swipes, and four
accessible onscreen direction buttons now call one `submitMoveCommand` entry point. That entry point
creates the source-tagged performance trace, records capture depth, applies the
same modal/tutorial/replay/game/terminal checks, and either starts, queues, or
classifies the command as dropped.

The existing serial contract is preserved: one command may be executing and at
most eight wait in FIFO order. An executing move sets both `busy` and the
in-flight ref, so the shared path checks in-flight first; touch and control
inputs now queue like keyboard inputs instead of being rejected as `busy`.
Pending depth also owns the brief response-to-render handoff, preventing an
input in that window from falling through to the unrelated-operation `busy`
classification.
The post-React-commit effect still drains one command using the current state,
avoiding a stale-render pump. Error, terminal, new-game, tutorial, and unmount
queue-clearing reasons remain unchanged.

The gesture-guided tutorial remains its own local state machine and does not use
the server move queue. Tutorial cancellation, rapid-input, and stale-state
behavior stays open under the later Phase 1 boundary-state item.

The onscreen control is a native-button D-pad with stable accessible names
`Move up`, `Move left`, `Move down`, and `Move right`. Each target is at least
44×44 CSS pixels and remains operable while a move is in flight so it can use
the queue. It is absent during the gesture-guided tutorial and when replay, a
blocking modal, game over, or a pending win decision makes directional input
unavailable. Arrow/WASD handling ignores
input, select, textarea, and contenteditable targets so form navigation does not
become a game command.

## Verification

The focused Playwright test holds each mocked move response for 150 ms, then
submits ten commands synchronously across keyboard, synthetic touch, and
onscreen-control sources. It proves:

- the first command executes and the next eight execute once in submitted FIFO
  direction order;
- all three source labels survive through the completed traces;
- queued commands retain capture, enqueue, and dequeue depth samples;
- the tenth command is classified once as `queue_full` at depth eight;
- terminal and failed first responses clear every queued command with the
  appropriate classified reason and send no later request;
- payload, local-storage, checkpoint, React-commit, and next-frame trace data
  remain intact; and
- the four controls are visible with 44×44-or-larger bounds.

The companion rejection test proves a focused Difficulty select keeps native
arrow-key behavior without producing a move trace, then a gameplay direction is
classified normally after focus leaves the form control.

This browser proof uses synthetic touch events. It establishes shared code-path
and ordering behavior but does not replace the open real-finger Pixel run.

## Acceptance record

- TypeScript validation passed with `npx tsc --noEmit`.
- The focused Chromium proof passed all four command-queue tests.
- The complete local UI suite passed 54 tests with one expected skip using the
  production-equivalent shell (`BINARY2048_DEV_NAV=0`).
- The complete unit suite passed 161 suites and 552 tests.
- The production bundle compiled, type-checked, and generated all 62 static
  pages. The local wrapper then reached the known environment-only smoke blocker:
  `/api/auth/bridge-token` returned 503 because the production bridge secret is
  intentionally unavailable locally.
