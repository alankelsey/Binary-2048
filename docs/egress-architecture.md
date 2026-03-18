# Binary-2048 Egress Architecture Note

## Current State

`main` is hosted on AWS Amplify using Next.js `WEB_COMPUTE`.

This runtime gives us:
- managed SSR and API routes
- simple deploy flow
- no guaranteed stable outbound IP address

That last point matters for services that depend on source-IP allowlisting, especially MongoDB Atlas.

## Why Amplify `WEB_COMPUTE` Is Awkward For Database Allowlists

Our app needs outbound access to:
- MongoDB Atlas
- OAuth providers
- Stripe and other webhook/payment systems
- S3 and AWS APIs

Amplify `WEB_COMPUTE` does not expose a fixed egress IP that we can safely allowlist in Atlas. The practical consequence is:

- Atlas network access often has to stay broad (`0.0.0.0/0`) or otherwise permissive
- credential strength and DB roles become the primary protection layer
- this is acceptable temporarily, but it is not the preferred long-term boundary

## Current Temporary Production Posture

Today the production posture is:

- app runtime: Amplify `WEB_COMPUTE`
- database: MongoDB Atlas
- replay/session persistence: Mongo + S3
- Atlas network access: temporarily broad to keep production functional

Compensating controls:

- strong rotated database credentials
- least-privilege DB user where possible
- server-side auth and entitlement checks
- WAF and route-level throttling
- production health checks and billing alarms

## Stable-Egress Options

### Option 1: Stay On Amplify Temporarily

Pros:
- lowest operational effort
- lowest immediate migration risk
- no architecture split

Cons:
- no stable outbound IP
- Atlas allowlist remains broad
- weaker network boundary than desired

### Option 2: Move DB-Calling Workloads Behind Fixed Egress

Typical approach:
- move Mongo-touching endpoints to Lambda or container workloads in a VPC
- route outbound traffic through NAT Gateway
- allowlist the NAT public IP(s) in Atlas

Pros:
- stable egress IPs
- preserves Atlas IP-based network boundary
- smaller migration than moving the full app

Cons:
- added cost floor from NAT
- more infrastructure to manage
- split architecture between Amplify and fixed-egress workloads

### Option 3: Use Atlas Private Connectivity

Typical approach:
- move workloads into a VPC with supported private connectivity
- connect to Atlas using PrivateLink or equivalent supported private path

Pros:
- strongest network posture
- removes public internet path from DB access

Cons:
- highest cost floor
- more infrastructure complexity
- may require Atlas tier/runtime changes beyond current lightweight setup

## Recommendation For This Repo

For Binary-2048 today:

1. Keep Amplify `WEB_COMPUTE` for the main app.
2. Keep the broad Atlas allowlist temporarily.
3. Maintain strong secrets rotation, DB role minimization, and monitoring.
4. Treat fixed egress as the next real security milestone once traffic and revenue justify the extra cost.
5. Treat private connectivity as a later-stage production hardening option, not a near-term requirement.

## Exit Criteria For Leaving Broad Atlas Access

We should stop relying on broad Atlas access when at least one of these is true:

- production traffic justifies the NAT/private-connectivity cost floor
- compliance/security requirements demand IP-restricted or private DB access
- abuse pressure or secret-handling risk makes a public Atlas listener unacceptable

## Follow-On Docs

This note explains the architecture constraint only.

Separate roadmap items cover:
- final egress strategy decision
- cost memo for NAT vs PrivateLink
- migration steps to remove broad Atlas access
