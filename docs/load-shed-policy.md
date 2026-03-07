# Load-Shed and Circuit-Breaker Policy

This policy defines actions when Binary-2048 experiences sustained latency/error pressure.

## Detection window

- Evaluate every 5 minutes.
- Trigger only when thresholds are breached for 2 consecutive windows.

## Trigger thresholds

- API 5xx rate >= 2%
- API p95 latency >= 1500ms
- Tournament queue saturation:
  - active slots at max, and
  - queue utilization >= 90%

## Actions (in order)

1. Enter `degrade_partial`:
   - set `BINARY2048_DEGRADE_DISABLE_TOURNAMENT=1`
   - keep core gameplay APIs active
2. If still breached after 10 minutes, enter `degrade_heavy`:
   - set `BINARY2048_DEGRADE_DISABLE_SIMULATE=1`
   - keep `/api/games` + `/api/games/:id/move` active
3. If still breached after 15 minutes, enter `degrade_global`:
   - set `BINARY2048_DEGRADE_MODE=1`
   - serve only static docs + status endpoint where possible

## Recovery

- Require 2 consecutive healthy windows before re-enabling endpoints.
- Re-enable in reverse order:
  1. disable global degrade
  2. re-enable simulate
  3. re-enable tournament

## Audit trail

- For each degrade transition, record:
  - UTC timestamp
  - triggering metrics
  - action taken
  - operator/automation source
  - recovery timestamp
