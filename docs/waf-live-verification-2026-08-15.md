# Live WAF Verification — 2026-08-15

This record compares the deployed AWS WAF configuration with the application
quota matrix. The checks were read-only and used AWS account `750629424234`.

## Association

- Amplify app: `Binary-2048` (`dzxvs1esr22z9`, `us-east-2`)
- Web ACL: `CreatedByAmplify-dzxvs1esr22z9-61b8dad7-1bb4-40a9-8784-a73c9a62a868`
- Web ACL ID: `5892d9f9-cc36-41a9-88fc-7180936b716c`
- Scope/region: `CLOUDFRONT`, queried through `us-east-1`
- `list-resources-for-web-acl` returned the expected Amplify app ARN, confirming
  the live association. Amplify's `get-app` response did not populate its
  optional `webAclArn` field, so the WAF association query is the authoritative
  evidence here.

## Initial deployed rules

At the initial 2026-08-15 check, the live ACL defaulted to allow and contained
only these rules:

| Priority | Rule | Type | Sampled requests |
|---:|---|---|---|
| 0 | `AWS-AWSManagedRulesAmazonIpReputationList` | AWS managed | enabled |
| 1 | `AWS-AWSManagedRulesCommonRuleSet` | AWS managed | enabled |
| 2 | `AWS-AWSManagedRulesKnownBadInputsRuleSet` | AWS managed | enabled |

No rate-based rule is deployed. Consequently, the live ACL has no WAF
threshold or scope-down path for `/api/`, `/api/games`, or `/move`.

The repository's intended game API template was therefore **not the deployed
policy** at that time. It defined the following absent controls:

| Intended rule | Threshold per IP | Scope | Action |
|---|---:|---|---|
| `CaptchaGamesCreateBurst` | 90 / 5 minutes | exactly `/api/games` | CAPTCHA |
| `CaptchaMoveBurst` | 180 / 5 minutes | URI contains `/move` | Challenge |
| `RateLimitApi` | 600 / 5 minutes | URI starts with `/api/` | Block |
| `RateLimitGlobal` | 2,000 / 5 minutes | all requests | Block |

## Visibility and observed behavior

- CloudWatch metrics and sampled requests are enabled on all three live rules.
- A sampled-request query covering `2026-08-15T23:28:08Z` through
  `2026-08-16T02:28:08Z` succeeded.
- `AWSManagedRulesCommonRuleSet` reported population size 32; the requested
  sample returned 20 blocked requests. They were automated probes for PHP and
  WordPress paths, demonstrating that the managed rule is actively blocking.
- The IP reputation and known-bad-input groups reported zero samples in that
  window.
- `get-logging-configuration` returned `WAFNonexistentItemException`, meaning
  full WAF request logging was not configured for this ACL. Sampled-request and
  CloudWatch metric visibility remain available, but they are not substitutes
  for retained request logs.

## Comparison with application quotas

The application currently enforces 600 moves, 60 simulations, 10 tournaments,
and 20 shared training requests per five minutes, keyed by a validated bot API
key ID with IP fallback. Those controls exist in application process memory.

At the initial check, the intended WAF rate rules were absent, so WAF was not
the real rate-limiting layer and provided no independent protection if
application limits were bypassed or an instance restarted. The planned WAF
controls were IP-keyed and shared across callers behind one public IP; they
could not provide the per-bot isolation of validated API keys. The former
180-per-five-minute move Challenge was also lower than the app's
600-per-five-minute move quota and would have challenged high-throughput bots
before their application quota was exhausted.

## Deployment follow-up — 2026-08-16

The bot-friendly backstop policy was applied in place to the same Amplify-managed
ACL. A pre-change rollback export is stored locally at
`/private/tmp/binary2048-waf-before-20260816.json`.

- All three managed rule groups were preserved.
- `RateLimitApi` now blocks at 6,000 requests per 300 seconds per IP and is
  scoped to URI paths starting with `/api/`.
- `RateLimitGlobal` now blocks at 12,000 requests per 300 seconds per IP.
- CAPTCHA and Challenge rules were intentionally omitted from bot-facing routes.
- Sampled requests and CloudWatch metrics are enabled on both rate rules.
- Full WAF logging now targets `aws-waf-logs-binary2048` in `us-east-1` with
  30-day retention.
- A post-update association query still returned Amplify app `dzxvs1esr22z9`.

This separates responsibilities: validated API keys control individual bot
quotas in the application, while WAF provides a larger IP-based emergency
backstop. The remaining verification step is a controlled threshold test in a
non-production environment; production was not flooded merely to manufacture a
sampled rate-limit block.
