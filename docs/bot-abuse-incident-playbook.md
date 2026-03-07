# Bot-Abuse Incident Playbook

This runbook defines how to detect, throttle, block, recover, and postmortem bot-driven abuse on Binary-2048.

## Scope

- API abuse bursts (especially heavy endpoints):
  - `POST /api/simulate`
  - `POST /api/bots/tournament`
- Cost-spike indicators from WAF, CloudWatch, and AWS Budgets.

## Severity levels

- `SEV-3` elevated noise:
  - short spikes, no user-visible impact.
- `SEV-2` active abuse:
  - elevated `429`/`403`, latency increase, queue pressure.
- `SEV-1` service/cost risk:
  - sustained high error rate or spend anomaly trend.

## Detect

Trigger incident when any of these holds for 2 consecutive 5-minute windows:

- API p95 latency >= 1500ms
- API 5xx rate >= 2%
- Tournament queue near saturation (>= 90%)
- WAF blocked/challenge spikes beyond baseline
- Billing tripwire/alert anomaly

Primary data sources:

- `GET /api/ops/telemetry`
- WAF logs and CloudWatch alarm state
- load artifacts in `docs/load-results/`
- Budget/alarm checks via:
  - `npm run ops:waf:tripwire-check`
  - `npm run ops:waf:status`

## Throttle

1. Tighten rate limits first:
- reduce `BINARY2048_RATE_LIMIT_SIMULATE_MAX`
- reduce `BINARY2048_RATE_LIMIT_TOURNAMENT_MAX`

2. Enforce challenge path for high-risk routes:
- ensure challenge mode is `enforce` for heavy endpoints.

3. Re-run fast verification:
- `BASE_URL=<target> npm run load:stage:abuse`

## Block

If abuse persists:

1. Enable endpoint-specific degrade toggles:
- `BINARY2048_DEGRADE_DISABLE_TOURNAMENT=1`
- if needed `BINARY2048_DEGRADE_DISABLE_SIMULATE=1`

2. Apply WAF tightening:
- lower API/global rate limits
- add temporary IP or country blocks for confirmed abusive sources

3. Last resort:
- `BINARY2048_DEGRADE_MODE=1` for broad heavy-route shutdown.

## Recover

Recovery requires 2 consecutive healthy windows:

- 5xx below threshold
- p95 below threshold
- queue utilization normalized

Recovery order:

1. Disable global degrade (if enabled)
2. Re-enable simulate
3. Re-enable tournament
4. Restore normal rate limits

After each step, wait one full 5-minute window and confirm metrics are stable.

## Postmortem template

- Incident ID:
- Start/end UTC:
- Severity:
- Trigger signal(s):
- Traffic profile summary:
- Mitigations applied (ordered):
- User impact:
- Cost impact:
- False-positive/false-negative notes:
- Permanent fixes:
- Follow-up owner + due date:

## Operational checklist

- [ ] Incident declared with severity
- [ ] Metrics snapshot captured
- [ ] Throttle changes applied
- [ ] Block/degrade actions applied if needed
- [ ] Stabilization confirmed for 2 windows
- [ ] Recovery steps completed
- [ ] Postmortem filed
