# Binary-2048 Fixed Egress Migration Runbook

## Purpose

This runbook turns the remaining open egress item into an executable migration plan.

The target outcome is:

- Mongo-touching workloads move off Amplify `WEB_COMPUTE`
- outbound traffic to MongoDB Atlas comes from stable NAT-backed public IPs
- Atlas network access is reduced from broad temporary access to explicit allowlisted addresses

This is the recommended intermediate step before any Atlas private-connectivity move.

## Scope

This runbook assumes:

- the main web experience remains on Amplify
- only Mongo-touching server routes move first
- replay/session persistence remains Mongo + S3
- auth/session secrets continue to be managed outside source control

## Target Architecture

Near-term target:

1. keep Amplify for public Next.js rendering and lightweight API routes
2. deploy a small fixed-egress runtime for Mongo-backed routes
3. attach that runtime to a VPC
4. route outbound internet traffic through NAT Gateway
5. allowlist the NAT public IP(s) in Atlas
6. cut Mongo traffic over to the fixed-egress runtime
7. remove the broad Atlas allowlist

## Candidate Runtime

The preferred first cut is:

- AWS Lambda in a VPC behind NAT

Alternative if packaging/runtime constraints become annoying:

- ECS Fargate service in private subnets behind NAT

Why Lambda first:

- lower engineering surface area for the current scale
- easier to carve out only the Mongo-backed routes
- keeps the rest of the app unchanged

## Routes To Carve Out First

Start with routes that touch persistent Mongo-backed state:

- `/api/runs/:id`
- `/api/runs/:id/replay`
- `/api/leaderboard`
- `/api/leaderboard/submit`
- Mongo-backed storage/ops verification endpoints
- any future session-backed ranked or tournament persistence routes

Do not move everything at once.

## Preconditions

Before migration:

- production storage health is green
- replay persistence to S3 is verified
- Mongo credentials are rotated and least-privilege
- Amplify production deploys are stable
- WAF and prod health checks are already in place

## Required AWS Resources

- one VPC
- at least two private subnets
- at least one public subnet
- one NAT Gateway
- one Elastic IP for the NAT Gateway
- route tables for private-subnet egress through NAT
- security groups for the fixed-egress workload
- IAM role for workload access to S3, CloudWatch Logs, and any secret store used

## Required Atlas Changes

- create or reuse a dedicated app DB user with `readWrite` on `binary2048`
- add the NAT Elastic IP to Atlas Network Access
- keep the broad allowlist until cutover is verified
- remove the broad allowlist only after post-cutover verification passes

## Environment Variables Needed In Fixed-Egress Runtime

- `BINARY2048_MONGO_URI`
- `BINARY2048_MONGO_DB`
- `BINARY2048_MONGO_RUN_COLLECTION`
- `BINARY2048_MONGO_SESSION_COLLECTION`
- `BINARY2048_REPLAY_ARTIFACT_STORE`
- `BINARY2048_REPLAY_S3_BUCKET`
- `BINARY2048_REPLAY_S3_REGION`
- `BINARY2048_REPLAY_S3_PREFIX`
- `BINARY2048_ADMIN_TOKEN`
- auth-related secrets used by migrated routes

## Migration Phases

### Phase 1: Carve-Out Preparation

- identify all Mongo-touching routes
- isolate shared route logic into reusable handlers
- ensure handlers are runtime-agnostic
- define the external URL contract for moved routes

Success criteria:

- moved routes can be hosted outside Amplify without application logic changes

### Phase 2: Fixed-Egress Runtime Provisioning

- create VPC + NAT + private subnets
- deploy the fixed-egress workload
- wire secrets and S3 access
- verify outbound internet access from private subnets

Success criteria:

- runtime can reach Atlas and S3 from the NAT-backed egress path

### Phase 3: Shadow Verification

- call the fixed-egress endpoints directly
- run storage health checks against the new runtime
- compare replay/session reads against current production
- compare leaderboard/runs responses between both paths

Success criteria:

- responses match expected schemas
- latency and error rate are acceptable
- no auth or replay regressions

### Phase 4: Controlled Cutover

- update the production app to send Mongo-backed traffic to the fixed-egress runtime
- keep the broad Atlas allowlist temporarily during the first live window
- monitor logs, latency, and health probes

Success criteria:

- production traffic succeeds through the new path
- no elevated 5xx rate
- storage health checks remain green

### Phase 5: Network Lockdown

- remove the broad Atlas allowlist
- keep only the NAT public IP(s)
- rerun all storage and replay verification checks

Success criteria:

- production remains healthy
- Atlas access is restricted to the approved stable egress path

## Validation Checklist

Run all of these after cutover:

- `npm run ops:release:auth-check`
- `npm run ops:prod:smoke`
- `npm run ops:prod:verify`
- `npm run ops:prod:storage-check`
- leaderboard read/write verification
- replay permalink verification
- S3 replay artifact write/read verification

Also verify from AWS:

- NAT Elastic IP is stable
- fixed-egress workload logs show successful Mongo connections
- Atlas connections originate from the allowlisted NAT IP

## Rollback Plan

Rollback trigger:

- elevated 5xx error rate
- auth/session regressions
- Mongo connection instability
- replay persistence mismatch

Rollback steps:

1. point production traffic back to the current Amplify-backed path
2. confirm storage health is green again
3. keep the broad Atlas allowlist in place during rollback
4. collect incident evidence and compare route behavior

Do not remove the broad allowlist until the new path is stable.

## Cost Notes

Minimum practical floor for the first secure step:

- one NAT Gateway plus data processing
- one small VPC-attached workload
- CloudWatch logging

That is the main reason this has remained a future milestone rather than a same-day change.

## Definition Of Done

This roadmap item is truly done only when:

- Mongo-backed production routes no longer depend on broad Atlas access
- Atlas is restricted to stable allowlisted egress addresses
- production checks are green after the lock-down
- rollback instructions are documented and tested
