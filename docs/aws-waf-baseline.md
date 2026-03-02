# AWS WAF Baseline (Binary-2048)

This is the first-pass production baseline for Amplify/CloudFront + Next.js API routes.

## Scope
- Attach Web ACL to CloudFront distribution behind Amplify.
- Keep default action `ALLOW` and block by explicit rules.

## Rule set (initial)
1. `AWSManagedRulesAmazonIpReputationList`
2. `AWSManagedRulesKnownBadInputsRuleSet`
3. `AWSManagedRulesCommonRuleSet`
4. `RateLimitApi` (`/api/*`, per IP, 5-minute window)
5. `RateLimitGlobal` (all paths, per IP, 5-minute window)
6. `GeoBlock` (only if you have a clear allow/deny policy)

## Initial thresholds
- `RateLimitApi`: `600` requests / 5 minutes / IP
- `RateLimitGlobal`: `2000` requests / 5 minutes / IP
- For abuse-sensitive endpoints (later):
  - `/api/games`
  - `/api/games/*/move`
  - `/api/games/import`
  - apply stricter path-specific rule, e.g. `120` / 5 minutes / IP

Tune after observing 3-7 days of traffic.

## Paid vs free tiers
Implement tiered limits after auth is in place:
- Free/guest: lower API limits.
- Auth + paid: higher API limits.
- Keep a hard global cap for all users.

## CAPTCHA/challenge
Start with Challenge/CAPTCHA only on suspicious bursts, not globally.
- Trigger on repeated high-rate abuse patterns.
- Prefer challenge first, CAPTCHA escalation second.

## Logging + alarms
- Enable WAF logs to CloudWatch Logs.
- Alerts:
  - blocked request spike
  - CAPTCHA/challenge spike
  - unusual country distribution

## Billing tripwire
- AWS Budgets alerts at 50%, 80%, 100%.
- CloudWatch billing anomaly alert to SNS/email.

## Route 53 hardening
- Avoid wildcard DNS unless required.
- Enable Route 53 query logging.
- Alarm on NXDOMAIN spikes and unusual query volume.

## Rollout process
1. Deploy with non-destructive posture where possible (Count for uncertain rules).
2. Watch logs 24-72 hours.
3. Convert high-confidence abusive patterns to Block.
4. Re-tune monthly.
