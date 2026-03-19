# Binary-2048 Production Egress Decision

## Decision

Binary-2048 will stay on Amplify `WEB_COMPUTE` with a temporary broad Atlas network allowlist in the near term.

This is a deliberate temporary posture, not the long-term target.

## Current State

- app hosting: Amplify `WEB_COMPUTE`
- outbound IPs: not stable or guaranteed
- database: MongoDB Atlas
- current practical network posture: broad allowlist to permit runtime connectivity

This works operationally, but it is weaker than a fixed-egress or private-connectivity model.

## Why This Is The Temporary Choice

This path has the lowest implementation cost and keeps the live product functional while the rest of the platform matures.

Reasons:

- no immediate re-platforming cost
- no NAT/VPC monthly floor yet
- no Atlas dedicated-cluster private-link spend yet
- keeps delivery velocity high while product and monetization are still evolving

## Security Tradeoff

The downside of a broad allowlist is larger network exposure.

Risk is reduced, but not eliminated, by:

- strong database credentials
- rotated secrets
- least-privilege database roles
- admin-token isolation
- monitoring and audit logging

This is acceptable only as a temporary measure.

## Alternative 1: Fixed Egress Behind NAT/VPC

### What it means

Move Mongo-touching workloads to infrastructure with stable outbound IPs, typically VPC-attached compute behind NAT.

### Monthly floor

Approximate base cost in `us-east-2`:

- one NAT gateway: about `$32/month` before data processing
- higher if using multiple AZs for HA
- plus compute cost for the migrated workload

### Engineering effort

Expected effort:

- small carve-out of DB-calling workloads: medium
- whole-app migration away from Amplify SSR: higher

### Benefits

- tighter Atlas allowlist
- clearer network boundary
- easier security review

## Alternative 2: Atlas Private Connectivity

### What it means

Use Atlas private connectivity such as PrivateLink where the hosting topology supports it.

### Cost posture

This has the highest monthly floor because it usually requires:

- Atlas tier support above the lowest-cost path
- private endpoint charges
- AWS interface endpoint charges

### Engineering effort

Expected effort is medium-to-high because DNS, VPC, endpoint policy, and hosting topology must all align.

### Benefits

- strongest network isolation
- best long-term security posture
- cleanest story for serious production handling

## Chosen Near-Term Path

Near term:

1. stay on Amplify
2. keep broad Atlas allowlist temporarily
3. maintain strong credentials and least-privilege roles
4. keep health checks and storage verification in production

## Exit Criteria For Temporary Broad Allowlist

Move off the broad allowlist when one or more of these become true:

- traffic and revenue justify fixed monthly infra cost
- external-value rewards move closer to production
- compliance or customer trust requirements tighten
- chat, messaging, or other higher-risk user-generated surfaces expand
- operational burden of the temporary model exceeds migration cost

## Migration Trigger Recommendation

The recommended next real step is not Atlas private connectivity first.

The recommended step is:

- carve Mongo-touching workloads into a fixed-egress runtime first

Why:

- lower cost than private connectivity at the current phase
- simpler migration path
- gives immediate security improvement without forcing full database platform escalation

## Final Position

Binary-2048 should keep the current broad allowlist temporarily, but treat fixed egress as the next security milestone and private connectivity as the later hardened production target.
