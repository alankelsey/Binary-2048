# Binary 2048 Performance Research Source

Date captured: 2026-09-17
Status: preserved research evidence; not an implementation plan

This document retains the original comparison discussion and production guest
gameplay log used by the two performance reports. The guest game identifier was
anonymized as `g_perf_sample`; timestamps, moves, scores, and response timing
were retained so the measurements remain reproducible. It contains no
credentials or authenticated session state.

Why is this game https://play2048.co/

More responsive than

https://www.binary2048.com/

That difference in feel usually comes down to architecture, and it lines up with what makes sense given how each site works:

**play2048.co (the original)** is about as minimal as a web app gets — vanilla JS, no framework, no network calls per move, and it moves tiles with CSS `transform`/`transition` so the browser's compositor handles animation on the GPU. Every input just mutates a local array and re-renders a few DOM nodes. There's essentially nothing between a keypress and a visual update.

**Binary-2048**, from what's in your build, has a lot more happening per move that play2048.co simply doesn't have:

- Deterministic RNG + HMAC-signed replay logging — likely serializing move state every turn
- Anti-cheat checks — probably validating each move against server-side or client-side rules
- A REST bot API layer — if any move data round-trips to a backend (even async), that's latency the original never pays
- Auth/session state (the "guest / Sign in" header) — extra context to check or re-render on each interaction
- A heavier options/accessibility surface (difficulty modes, colorblind themes, tab-order map) — more DOM and more re-render surface area if it's not memoized well

The most common culprits for _perceived_ sluggishness specifically are:

1. **Move animation done via JS/React state updates instead of CSS transitions** — if tile position changes trigger a full re-render rather than a CSS transform, you lose GPU compositing and it feels laggy even at 60fps.
2. **Synchronous work on the input handler** — if replay logging, HMAC signing, or anti-cheat validation happens _before_ the UI updates (rather than after, or in a Web Worker/async), every keypress waits on that work first.
3. **React re-render cascades** — if the whole board re-renders on each move instead of just changed tiles, that's measurable overhead the vanilla original doesn't have.

If you want, I can look at your actual move-handling code (input → state update → render → replay log order) and point out exactly where the extra latency is being introduced.

504 2026-09-17T23:20:01.144Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=165 turn=161
505 2026-09-17T23:20:07.565Z INFO move_request dir=right gameId=g_perf_sample turn=161 score=993 recoveryMoves=165 recoveryRetry=false
506 2026-09-17T23:20:07.727Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=162 score=994 recoveryMoves=166 error=null
507 2026-09-17T23:20:07.727Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=166 turn=162
508 2026-09-17T23:20:11.794Z INFO move_request dir=up gameId=g_perf_sample turn=162 score=994 recoveryMoves=166 recoveryRetry=false
509 2026-09-17T23:20:11.959Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=163 score=996 recoveryMoves=167 error=null
510 2026-09-17T23:20:11.960Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=167 turn=163
511 2026-09-17T23:20:12.904Z INFO move_request dir=up gameId=g_perf_sample turn=163 score=996 recoveryMoves=167 recoveryRetry=false
512 2026-09-17T23:20:13.085Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=164 score=1000 recoveryMoves=168 error=null
513 2026-09-17T23:20:13.086Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=168 turn=164
514 2026-09-17T23:20:17.587Z INFO move_request dir=right gameId=g_perf_sample turn=164 score=1000 recoveryMoves=168 recoveryRetry=false
515 2026-09-17T23:20:17.713Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=165 score=1008 recoveryMoves=169 error=null
516 2026-09-17T23:20:17.714Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=169 turn=165
517 2026-09-17T23:20:19.255Z INFO move_request dir=up gameId=g_perf_sample turn=165 score=1008 recoveryMoves=169 recoveryRetry=false
518 2026-09-17T23:20:19.517Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=166 score=1044 recoveryMoves=170 error=null
519 2026-09-17T23:20:19.518Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=170 turn=166
520 2026-09-17T23:20:21.546Z INFO move_request dir=right gameId=g_perf_sample turn=166 score=1044 recoveryMoves=170 recoveryRetry=false
521 2026-09-17T23:20:21.694Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=167 score=1048 recoveryMoves=171 error=null
522 2026-09-17T23:20:21.695Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=171 turn=167
523 2026-09-17T23:20:22.753Z INFO move_request dir=right gameId=g_perf_sample turn=167 score=1048 recoveryMoves=171 recoveryRetry=false
524 2026-09-17T23:20:22.888Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=168 score=1050 recoveryMoves=172 error=null
525 2026-09-17T23:20:22.888Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=172 turn=168
526 2026-09-17T23:20:24.433Z INFO move_request dir=down gameId=g_perf_sample turn=168 score=1050 recoveryMoves=172 recoveryRetry=false
527 2026-09-17T23:20:24.585Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=169 score=1054 recoveryMoves=173 error=null
528 2026-09-17T23:20:24.586Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=173 turn=169
529 2026-09-17T23:20:25.559Z INFO move_request dir=up gameId=g_perf_sample turn=169 score=1054 recoveryMoves=173 recoveryRetry=false
530 2026-09-17T23:20:25.855Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=170 score=1056 recoveryMoves=174 error=null
531 2026-09-17T23:20:25.856Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=174 turn=170
532 2026-09-17T23:20:27.898Z INFO move_request dir=right gameId=g_perf_sample turn=170 score=1056 recoveryMoves=174 recoveryRetry=false
533 2026-09-17T23:20:28.186Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=171 score=1064 recoveryMoves=175 error=null
534 2026-09-17T23:20:28.187Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=175 turn=171
535 2026-09-17T23:20:28.894Z INFO move_request dir=up gameId=g_perf_sample turn=171 score=1064 recoveryMoves=175 recoveryRetry=false
536 2026-09-17T23:20:29.135Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=172 score=1144 recoveryMoves=176 error=null
537 2026-09-17T23:20:29.135Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=176 turn=172
538 2026-09-17T23:20:33.820Z INFO move_request dir=right gameId=g_perf_sample turn=172 score=1144 recoveryMoves=176 recoveryRetry=false
539 2026-09-17T23:20:34.463Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=173 score=1146 recoveryMoves=177 error=null
540 2026-09-17T23:20:34.464Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=177 turn=173
541 2026-09-17T23:20:36.733Z INFO move_request dir=left gameId=g_perf_sample turn=173 score=1146 recoveryMoves=177 recoveryRetry=false
542 2026-09-17T23:20:37.044Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=174 score=1146 recoveryMoves=178 error=null
543 2026-09-17T23:20:37.044Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=178 turn=174
544 2026-09-17T23:20:38.027Z INFO move_request dir=up gameId=g_perf_sample turn=174 score=1146 recoveryMoves=178 recoveryRetry=false
545 2026-09-17T23:20:38.184Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=175 score=1148 recoveryMoves=179 error=null
546 2026-09-17T23:20:38.184Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=179 turn=175
547 2026-09-17T23:20:41.638Z INFO move_request dir=left gameId=g_perf_sample turn=175 score=1148 recoveryMoves=179 recoveryRetry=false
548 2026-09-17T23:20:41.766Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=176 score=1149 recoveryMoves=180 error=null
549 2026-09-17T23:20:41.767Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=180 turn=176
550 2026-09-17T23:20:43.135Z INFO move_request dir=up gameId=g_perf_sample turn=176 score=1149 recoveryMoves=180 recoveryRetry=false
551 2026-09-17T23:20:43.304Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=177 score=1161 recoveryMoves=181 error=null
552 2026-09-17T23:20:43.304Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=181 turn=177
553 2026-09-17T23:20:45.603Z INFO move_request dir=left gameId=g_perf_sample turn=177 score=1161 recoveryMoves=181 recoveryRetry=false
554 2026-09-17T23:20:45.715Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=178 score=1163 recoveryMoves=182 error=null
555 2026-09-17T23:20:45.716Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=182 turn=178
556 2026-09-17T23:20:47.912Z INFO move_request dir=down gameId=g_perf_sample turn=178 score=1163 recoveryMoves=182 recoveryRetry=false
557 2026-09-17T23:20:48.073Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=179 score=1179 recoveryMoves=183 error=null
558 2026-09-17T23:20:48.074Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=183 turn=179
559 2026-09-17T23:20:48.503Z INFO move_request dir=up gameId=g_perf_sample turn=179 score=1179 recoveryMoves=183 recoveryRetry=false
560 2026-09-17T23:20:48.722Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=180 score=1179 recoveryMoves=184 error=null
561 2026-09-17T23:20:48.723Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=184 turn=180
562 2026-09-17T23:20:50.345Z INFO move_request dir=right gameId=g_perf_sample turn=180 score=1179 recoveryMoves=184 recoveryRetry=false
563 2026-09-17T23:20:50.483Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=181 score=1195 recoveryMoves=185 error=null
564 2026-09-17T23:20:50.484Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=185 turn=181
565 2026-09-17T23:20:52.516Z INFO move_request dir=up gameId=g_perf_sample turn=181 score=1195 recoveryMoves=185 recoveryRetry=false
566 2026-09-17T23:20:52.714Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=182 score=1195 recoveryMoves=186 error=null
567 2026-09-17T23:20:52.715Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=186 turn=182
568 2026-09-17T23:20:53.816Z INFO move_request dir=up gameId=g_perf_sample turn=182 score=1195 recoveryMoves=186 recoveryRetry=false
569 2026-09-17T23:20:54.010Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=183 score=1197 recoveryMoves=187 error=null
570 2026-09-17T23:20:54.011Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=187 turn=183
571 2026-09-17T23:20:54.662Z INFO move_request dir=right gameId=g_perf_sample turn=183 score=1197 recoveryMoves=187 recoveryRetry=false
572 2026-09-17T23:20:55.166Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=184 score=1203 recoveryMoves=188 error=null
573 2026-09-17T23:20:55.167Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=188 turn=184
574 2026-09-17T23:20:56.403Z INFO move_request dir=right gameId=g_perf_sample turn=184 score=1203 recoveryMoves=188 recoveryRetry=false
575 2026-09-17T23:20:56.550Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=185 score=1205 recoveryMoves=189 error=null
576 2026-09-17T23:20:56.551Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=189 turn=185
577 2026-09-17T23:20:58.874Z INFO move_request dir=up gameId=g_perf_sample turn=185 score=1205 recoveryMoves=189 recoveryRetry=false
578 2026-09-17T23:20:59.013Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=186 score=1209 recoveryMoves=190 error=null
579 2026-09-17T23:20:59.013Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=190 turn=186
580 2026-09-17T23:21:00.030Z INFO move_request dir=right gameId=g_perf_sample turn=186 score=1209 recoveryMoves=190 recoveryRetry=false
581 2026-09-17T23:21:00.158Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=187 score=1211 recoveryMoves=191 error=null
582 2026-09-17T23:21:00.158Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=191 turn=187
583 2026-09-17T23:21:00.833Z INFO move_request dir=right gameId=g_perf_sample turn=187 score=1211 recoveryMoves=191 recoveryRetry=false
584 2026-09-17T23:21:01.041Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=188 score=1231 recoveryMoves=192 error=null
585 2026-09-17T23:21:01.042Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=192 turn=188
586 2026-09-17T23:21:02.474Z INFO move_request dir=right gameId=g_perf_sample turn=188 score=1231 recoveryMoves=192 recoveryRetry=false
587 2026-09-17T23:21:02.744Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=189 score=1239 recoveryMoves=193 error=null
588 2026-09-17T23:21:02.746Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=193 turn=189
589 2026-09-17T23:21:04.352Z INFO move_request dir=left gameId=g_perf_sample turn=189 score=1239 recoveryMoves=193 recoveryRetry=false
590 2026-09-17T23:21:05.029Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=190 score=1243 recoveryMoves=194 error=null
591 2026-09-17T23:21:05.029Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=194 turn=190
592 2026-09-17T23:21:06.954Z INFO move_request dir=right gameId=g_perf_sample turn=190 score=1243 recoveryMoves=194 recoveryRetry=false
593 2026-09-17T23:21:07.129Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=191 score=1243 recoveryMoves=195 error=null
594 2026-09-17T23:21:07.130Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=195 turn=191
595 2026-09-17T23:21:08.833Z INFO move_request dir=up gameId=g_perf_sample turn=191 score=1243 recoveryMoves=195 recoveryRetry=false
596 2026-09-17T23:21:09.112Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=192 score=1245 recoveryMoves=196 error=null
597 2026-09-17T23:21:09.114Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=196 turn=192
598 2026-09-17T23:21:10.461Z INFO move_request dir=left gameId=g_perf_sample turn=192 score=1245 recoveryMoves=196 recoveryRetry=false
599 2026-09-17T23:21:10.673Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=193 score=1245 recoveryMoves=197 error=null
600 2026-09-17T23:21:10.673Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=197 turn=193
601 2026-09-17T23:21:12.186Z INFO move_request dir=right gameId=g_perf_sample turn=193 score=1245 recoveryMoves=197 recoveryRetry=false
602 2026-09-17T23:21:12.322Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=194 score=1250 recoveryMoves=198 error=null
603 2026-09-17T23:21:12.324Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=198 turn=194
604 2026-09-17T23:21:15.438Z INFO move_request dir=left gameId=g_perf_sample turn=194 score=1250 recoveryMoves=198 recoveryRetry=false
605 2026-09-17T23:21:15.594Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=195 score=1250 recoveryMoves=199 error=null
606 2026-09-17T23:21:15.594Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=199 turn=195
607 2026-09-17T23:21:16.613Z INFO move_request dir=right gameId=g_perf_sample turn=195 score=1250 recoveryMoves=199 recoveryRetry=false
608 2026-09-17T23:21:16.862Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=196 score=1252 recoveryMoves=200 error=null
609 2026-09-17T23:21:16.863Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=200 turn=196
610 2026-09-17T23:21:18.582Z INFO move_request dir=down gameId=g_perf_sample turn=196 score=1252 recoveryMoves=200 recoveryRetry=false
611 2026-09-17T23:21:18.694Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=197 score=1258 recoveryMoves=201 error=null
612 2026-09-17T23:21:18.695Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=201 turn=197
613 2026-09-17T23:21:19.418Z INFO move_request dir=up gameId=g_perf_sample turn=197 score=1258 recoveryMoves=201 recoveryRetry=false
614 2026-09-17T23:21:19.704Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=198 score=1258 recoveryMoves=202 error=null
615 2026-09-17T23:21:19.705Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=202 turn=198
616 2026-09-17T23:21:21.680Z INFO move_request dir=up gameId=g_perf_sample turn=198 score=1258 recoveryMoves=202 recoveryRetry=false
617 2026-09-17T23:21:21.857Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=199 score=1258 recoveryMoves=203 error=null
618 2026-09-17T23:21:21.858Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=203 turn=199
619 2026-09-17T23:21:23.131Z INFO move_request dir=right gameId=g_perf_sample turn=199 score=1258 recoveryMoves=203 recoveryRetry=false
620 2026-09-17T23:21:23.291Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=200 score=1290 recoveryMoves=204 error=null
621 2026-09-17T23:21:23.292Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=204 turn=200
622 2026-09-17T23:21:25.616Z INFO move_request dir=left gameId=g_perf_sample turn=200 score=1290 recoveryMoves=204 recoveryRetry=false
623 2026-09-17T23:21:25.757Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=201 score=1290 recoveryMoves=205 error=null
624 2026-09-17T23:21:25.757Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=205 turn=201
625 2026-09-17T23:21:27.582Z INFO move_request dir=right gameId=g_perf_sample turn=201 score=1290 recoveryMoves=205 recoveryRetry=false
626 2026-09-17T23:21:27.836Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=202 score=1292 recoveryMoves=206 error=null
627 2026-09-17T23:21:27.836Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=206 turn=202
628 2026-09-17T23:21:29.547Z INFO move_request dir=left gameId=g_perf_sample turn=202 score=1292 recoveryMoves=206 recoveryRetry=false
629 2026-09-17T23:21:29.724Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=203 score=1292 recoveryMoves=207 error=null
630 2026-09-17T23:21:29.724Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=207 turn=203
631 2026-09-17T23:21:31.664Z INFO move_request dir=up gameId=g_perf_sample turn=203 score=1292 recoveryMoves=207 recoveryRetry=false
632 2026-09-17T23:21:31.817Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=204 score=1292 recoveryMoves=208 error=null
633 2026-09-17T23:21:31.818Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=208 turn=204
634 2026-09-17T23:21:32.703Z INFO move_request dir=right gameId=g_perf_sample turn=204 score=1292 recoveryMoves=208 recoveryRetry=false
635 2026-09-17T23:21:32.883Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=205 score=1292 recoveryMoves=209 error=null
636 2026-09-17T23:21:32.883Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=209 turn=205
637 2026-09-17T23:21:35.491Z INFO move_request dir=down gameId=g_perf_sample turn=205 score=1292 recoveryMoves=209 recoveryRetry=false
638 2026-09-17T23:21:35.703Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=206 score=1294 recoveryMoves=210 error=null
639 2026-09-17T23:21:35.703Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=210 turn=206
640 2026-09-17T23:21:40.459Z INFO move_request dir=right gameId=g_perf_sample turn=206 score=1294 recoveryMoves=210 recoveryRetry=false
641 2026-09-17T23:21:40.677Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=207 score=1460 recoveryMoves=211 error=null
642 2026-09-17T23:21:40.677Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=211 turn=207
643 2026-09-17T23:21:43.230Z INFO move_request dir=up gameId=g_perf_sample turn=207 score=1460 recoveryMoves=211 recoveryRetry=false
644 2026-09-17T23:21:43.504Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=208 score=1500 recoveryMoves=212 error=null
645 2026-09-17T23:21:43.505Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=212 turn=208
646 2026-09-17T23:21:45.023Z INFO move_request d
644 2026-09-17T23:21:43.504Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=208 score=1500 recoveryMoves=212 error=null
645 2026-09-17T23:21:43.505Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=212 turn=208
646 2026-09-17T23:21:45.023Z INFO move_request dir=down gameId=g_perf_sample turn=208 score=1500 recoveryMoves=212 recoveryRetry=false
647 2026-09-17T23:21:45.153Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=209 score=1508 recoveryMoves=213 error=null
648 2026-09-17T23:21:45.153Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=213 turn=209
649 2026-09-17T23:21:47.783Z INFO move_request dir=right gameId=g_perf_sample turn=209 score=1508 recoveryMoves=213 recoveryRetry=false
650 2026-09-17T23:21:50.514Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=210 score=1540 recoveryMoves=214 error=null
651 2026-09-17T23:21:50.516Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=214 turn=210
652 2026-09-17T23:21:52.647Z INFO move_request dir=right gameId=g_perf_sample turn=210 score=1540 recoveryMoves=214 recoveryRetry=false
653 2026-09-17T23:21:52.815Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=211 score=1542 recoveryMoves=215 error=null
654 2026-09-17T23:21:52.815Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=215 turn=211
655 2026-09-17T23:21:54.176Z INFO move_request dir=down gameId=g_perf_sample turn=211 score=1542 recoveryMoves=215 recoveryRetry=false
656 2026-09-17T23:21:54.339Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=212 score=1546 recoveryMoves=216 error=null
657 2026-09-17T23:21:54.340Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=216 turn=212
658 2026-09-17T23:21:56.664Z INFO move_request dir=right gameId=g_perf_sample turn=212 score=1546 recoveryMoves=216 recoveryRetry=false
659 2026-09-17T23:21:56.801Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=213 score=1547 recoveryMoves=217 error=null
660 2026-09-17T23:21:56.802Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=217 turn=213
661 2026-09-17T23:21:57.731Z INFO move_request dir=right gameId=g_perf_sample turn=213 score=1547 recoveryMoves=217 recoveryRetry=false
662 2026-09-17T23:21:57.866Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=214 score=1547 recoveryMoves=218 error=null
663 2026-09-17T23:21:57.867Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=218 turn=214
664 2026-09-17T23:21:59.104Z INFO move_request dir=down gameId=g_perf_sample turn=214 score=1547 recoveryMoves=218 recoveryRetry=false
665 2026-09-17T23:21:59.249Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=215 score=1551 recoveryMoves=219 error=null
666 2026-09-17T23:21:59.250Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=219 turn=215
667 2026-09-17T23:22:01.349Z INFO move_request dir=left gameId=g_perf_sample turn=215 score=1551 recoveryMoves=219 recoveryRetry=false
668 2026-09-17T23:22:01.603Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=216 score=1551 recoveryMoves=220 error=null
669 2026-09-17T23:22:01.604Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=220 turn=216
670 2026-09-17T23:22:03.199Z INFO move_request dir=right gameId=g_perf_sample turn=216 score=1551 recoveryMoves=220 recoveryRetry=false
671 2026-09-17T23:22:03.394Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=217 score=1551 recoveryMoves=221 error=null
672 2026-09-17T23:22:03.395Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=221 turn=217
673 2026-09-17T23:22:05.293Z INFO move_request dir=right gameId=g_perf_sample turn=217 score=1551 recoveryMoves=221 recoveryRetry=false
674 2026-09-17T23:22:05.431Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=218 score=1615 recoveryMoves=222 error=null
675 2026-09-17T23:22:05.432Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=222 turn=218
676 2026-09-17T23:22:07.362Z INFO move_request dir=right gameId=g_perf_sample turn=218 score=1615 recoveryMoves=222 recoveryRetry=false
677 2026-09-17T23:22:07.564Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=219 score=1615 recoveryMoves=223 error=null
678 2026-09-17T23:22:07.565Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=223 turn=219
679 2026-09-17T23:22:08.176Z INFO move_request dir=down gameId=g_perf_sample turn=219 score=1615 recoveryMoves=223 recoveryRetry=false
680 2026-09-17T23:22:08.386Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=220 score=1619 recoveryMoves=224 error=null
681 2026-09-17T23:22:08.386Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=224 turn=220
682 2026-09-17T23:22:09.609Z INFO move_request dir=left gameId=g_perf_sample turn=220 score=1619 recoveryMoves=224 recoveryRetry=false
683 2026-09-17T23:22:09.732Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=221 score=1623 recoveryMoves=225 error=null
684 2026-09-17T23:22:09.733Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=225 turn=221
685 2026-09-17T23:22:10.291Z INFO move_request dir=right gameId=g_perf_sample turn=221 score=1623 recoveryMoves=225 recoveryRetry=false
686 2026-09-17T23:22:10.563Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=222 score=1623 recoveryMoves=226 error=null
687 2026-09-17T23:22:10.563Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=226 turn=222
688 2026-09-17T23:22:12.405Z INFO move_request dir=up gameId=g_perf_sample turn=222 score=1623 recoveryMoves=226 recoveryRetry=false
689 2026-09-17T23:22:12.580Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=223 score=1633 recoveryMoves=227 error=null
690 2026-09-17T23:22:12.580Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=227 turn=223
691 2026-09-17T23:22:13.956Z INFO move_request dir=left gameId=g_perf_sample turn=223 score=1633 recoveryMoves=227 recoveryRetry=false
692 2026-09-17T23:22:14.257Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=224 score=1653 recoveryMoves=228 error=null
693 2026-09-17T23:22:14.258Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=228 turn=224
694 2026-09-17T23:22:17.148Z INFO move_request dir=down gameId=g_perf_sample turn=224 score=1653 recoveryMoves=228 recoveryRetry=false
695 2026-09-17T23:22:17.332Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=225 score=1657 recoveryMoves=229 error=null
696 2026-09-17T23:22:17.333Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=229 turn=225
697 2026-09-17T23:22:20.670Z INFO move_request dir=left gameId=g_perf_sample turn=225 score=1657 recoveryMoves=229 recoveryRetry=false
698 2026-09-17T23:22:20.893Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=226 score=1657 recoveryMoves=230 error=null
699 2026-09-17T23:22:20.894Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=230 turn=226
700 2026-09-17T23:22:21.947Z INFO move_request dir=right gameId=g_perf_sample turn=226 score=1657 recoveryMoves=230 recoveryRetry=false
701 2026-09-17T23:22:22.119Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=227 score=1659 recoveryMoves=231 error=null
702 2026-09-17T23:22:22.119Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=231 turn=227
703 2026-09-17T23:22:24.042Z INFO move_request dir=up gameId=g_perf_sample turn=227 score=1659 recoveryMoves=231 recoveryRetry=false
704 2026-09-17T23:22:24.258Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=228 score=1663 recoveryMoves=232 error=null
705 2026-09-17T23:22:24.258Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=232 turn=228
706 2026-09-17T23:22:26.003Z INFO move_request dir=right gameId=g_perf_sample turn=228 score=1663 recoveryMoves=232 recoveryRetry=false
707 2026-09-17T23:22:26.139Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=229 score=1663 recoveryMoves=233 error=null
708 2026-09-17T23:22:26.139Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=233 turn=229
709 2026-09-17T23:22:27.456Z INFO move_request dir=down gameId=g_perf_sample turn=229 score=1663 recoveryMoves=233 recoveryRetry=false
710 2026-09-17T23:22:27.671Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=230 score=1665 recoveryMoves=234 error=null
711 2026-09-17T23:22:27.672Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=234 turn=230
712 2026-09-17T23:22:28.595Z INFO move_request dir=up gameId=g_perf_sample turn=230 score=1665 recoveryMoves=234 recoveryRetry=false
713 2026-09-17T23:22:28.755Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=231 score=1666 recoveryMoves=235 error=null
714 2026-09-17T23:22:28.755Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=235 turn=231
715 2026-09-17T23:22:29.924Z INFO move_request dir=right gameId=g_perf_sample turn=231 score=1666 recoveryMoves=235 recoveryRetry=false
716 2026-09-17T23:22:30.052Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=232 score=1668 recoveryMoves=236 error=null
717 2026-09-17T23:22:30.053Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=236 turn=232
718 2026-09-17T23:22:31.286Z INFO move_request dir=up gameId=g_perf_sample turn=232 score=1668 recoveryMoves=236 recoveryRetry=false
719 2026-09-17T23:22:31.444Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=233 score=1672 recoveryMoves=237 error=null
720 2026-09-17T23:22:31.444Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=237 turn=233
721 2026-09-17T23:22:32.696Z INFO move_request dir=right gameId=g_perf_sample turn=233 score=1672 recoveryMoves=237 recoveryRetry=false
722 2026-09-17T23:22:32.830Z INFO move_response dir=right status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=234 score=1682 recoveryMoves=238 error=null
723 2026-09-17T23:22:32.831Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=238 turn=234
724 2026-09-17T23:22:35.716Z INFO move_request dir=down gameId=g_perf_sample turn=234 score=1682 recoveryMoves=238 recoveryRetry=false
725 2026-09-17T23:22:35.857Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=235 score=1682 recoveryMoves=239 error=null
726 2026-09-17T23:22:35.858Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=239 turn=235
727 2026-09-17T23:22:36.310Z INFO move_request dir=up gameId=g_perf_sample turn=235 score=1682 recoveryMoves=239 recoveryRetry=false
728 2026-09-17T23:22:36.511Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=236 score=1718 recoveryMoves=240 error=null
729 2026-09-17T23:22:36.511Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=240 turn=236
730 2026-09-17T23:22:38.098Z INFO move_request dir=down gameId=g_perf_sample turn=236 score=1718 recoveryMoves=240 recoveryRetry=false
731 2026-09-17T23:22:38.278Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=237 score=1718 recoveryMoves=241 error=null
732 2026-09-17T23:22:38.278Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=241 turn=237
733 2026-09-17T23:22:38.843Z INFO move_request dir=up gameId=g_perf_sample turn=237 score=1718 recoveryMoves=241 recoveryRetry=false
734 2026-09-17T23:22:39.078Z INFO move_response dir=up status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=238 score=1718 recoveryMoves=242 error=null
735 2026-09-17T23:22:39.079Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=242 turn=238
736 2026-09-17T23:22:39.974Z INFO move_request dir=left gameId=g_perf_sample turn=238 score=1718 recoveryMoves=242 recoveryRetry=false
737 2026-09-17T23:22:40.126Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=239 score=1718 recoveryMoves=243 error=null
738 2026-09-17T23:22:40.127Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=243 turn=239
739 2026-09-17T23:22:51.330Z INFO move_request dir=left gameId=g_perf_sample turn=239 score=1718 recoveryMoves=243 recoveryRetry=false
740 2026-09-17T23:22:51.610Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=240 score=1734 recoveryMoves=244 error=null
741 2026-09-17T23:22:51.611Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=244 turn=240
742 2026-09-17T23:22:58.604Z INFO move_request dir=down gameId=g_perf_sample turn=240 score=1734 recoveryMoves=244 recoveryRetry=false
743 2026-09-17T23:22:58.772Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=241 score=1738 recoveryMoves=245 error=null
744 2026-09-17T23:22:58.773Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=245 turn=241
745 2026-09-17T23:23:02.568Z INFO move_request dir=left gameId=g_perf_sample turn=241 score=1738 recoveryMoves=245 recoveryRetry=false
746 2026-09-17T23:23:02.725Z INFO move_response dir=left status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=242 score=1742 recoveryMoves=246 error=null
747 2026-09-17T23:23:02.726Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=246 turn=242
748 2026-09-17T23:23:04.994Z INFO move_request dir=down gameId=g_perf_sample turn=242 score=1742 recoveryMoves=246 recoveryRetry=false
749 2026-09-17T23:23:05.409Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=243 score=1742 recoveryMoves=247 error=null
750 2026-09-17T23:23:05.410Z INFO recovery_snapshot_saved gameId=g_perf_sample moves=247 turn=243
751 2026-09-17T23:23:10.697Z INFO move_request dir=down gameId=g_perf_sample turn=243 score=1742 recoveryMoves=247 recoveryRetry=false
752 2026-09-17T23:23:10.910Z INFO move_response dir=down status=200 requestGameId=g_perf_sample responseGameId=g_perf_sample turn=244 score=1744 recoveryMoves=248 error=null
753 2026-09-17T23:23:10.911Z INFO recovery_snapshot_saved
