# Cloudflare compatibility spike (2026-10-28)

<!-- cspell:words vinext subrequests Hyperdrive -->

## Decision

Reject Cloudflare Workers as a current migration candidate. Do not initialize,
deploy, or provision it for Binary 2048 yet. Re-run the compatibility spike
after the application can move past Next.js 15/NextAuth v4 or Cloudflare's
compatibility surface changes materially.

This is a compatibility decision, not a claim that Workers cannot host any
Next.js or MongoDB application.

## Adapter and framework result

The repository currently uses Next.js 15.5.12 and NextAuth 4.24.13. As of the
spike date, Cloudflare's [official Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
recommends the beta `vinext` path and describes migration of existing Next.js
16 applications. The older [OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
remains documented for existing OpenNext applications that cannot yet migrate;
it is not the preferred new path.

The official `npx vinext check` command completed against this repository with
an overall result of 36% compatibility: 8 supported checks and 14 issues. The
blocking results were:

- only 2 of 13 detected `next/*` imports recognized;
- the custom webpack configuration requires migration to Vite;
- NextAuth was reported incompatible because it depends on Next.js route
  internals;
- the package is not ESM (`"type": "module"` is absent);
- the checker itself targets Node 20.19+ or 22.12+, while the local acceptance
  environment is Node 18.20.5.

The repository was not mutated by the checker. Running `vinext init` would
change the package/module/build system and is outside a bounded compatibility
spike.

## Runtime limits and behavior

The [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [pricing](https://developers.cloudflare.com/workers/platform/pricing/)
record:

- Free: 100,000 requests/day, 10 ms CPU/invocation, 128 MB memory, and 50
  subrequests/request.
- Paid: $5/month minimum, 10 million requests and 30 million CPU-ms included
  monthly, then request/CPU overages; 128 MB memory and up to 5 minutes CPU per
  invocation (30 seconds by default).
- Duration waiting on network I/O is not billed as CPU, but this application
  still needs measured route CPU before either tier can be judged.

Cloudflare documents App Router, route handlers, middleware, streaming, SSR,
SSG, and ISR as supported by vinext. `next/*` is only mostly supported and
image optimization is partial. OpenNext supports Cloudflare Images but does not
support Node.js middleware introduced in Next.js 15.2. This repository has no
`middleware.ts`, so that specific gap is not the blocker; auth and framework
internals are.

## MongoDB and network controls

Cloudflare's [MongoDB integration guide](https://developers.cloudflare.com/workers/databases/third-party-integrations/mongodb/)
supports the native driver through Node compatibility and TCP/TLS. It also
states that Hyperdrive does not support MongoDB, a plain Worker opens a new
connection per invocation with roughly 300 ms overhead, and a Durable Object is
needed to reuse a connection (documented warm query latency roughly 35 ms).

That architecture conflicts with the repository's shared process-level
`MongoClient`, multi-collection stores, and transaction-based inventory code.
It would require moving Mongo operations behind a Durable Object and proving
transaction/session behavior. Workers outbound TCP also does not originate
from Cloudflare's published IP ranges, so it does not satisfy the plan's
fixed-egress Atlas restriction without another network design.

No Atlas connection was attempted: credentials and an approved non-production
network target are required for that separate candidate-connectivity gate.

## Cache, images, secrets, and operations

- ISR/cache behavior would move to Workers caching and likely R2 bindings;
  current Next build output cannot simply be uploaded unchanged.
- Image behavior would depend on Cloudflare Images or vinext's partial request-
  time integration; there is no equivalence proof yet.
- Runtime secrets should use Wrangler secrets/bindings. The current
  `next.config.mjs` bakes server secrets into build-time `env`, which is an
  explicit migration blocker and must not be carried forward.
- SQS, S3, CloudWatch logs/alarms, WAF evidence, and deployment rollback remain
  AWS-specific and need retained-AWS bridges or replacements.

## Revisit gate

Re-run only when all of these are true:

1. Node 20.19+ is the checked-in build/runtime baseline.
2. NextAuth and the unrecognized Next internals have a supported path.
3. The Vite/ESM migration can be tested on a branch without replacing the
   accepted Next build.
4. A non-production Atlas target and cost cap are approved for TCP/TLS,
   transaction, connection-reuse, regional-latency, and network-control tests.
