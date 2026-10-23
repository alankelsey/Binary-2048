import { STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";
import { COMPACT_SYNC_VERSION } from "@/lib/binary2048/compact-sync";
import { COMPACT_RECOVERY_VERSION } from "@/lib/binary2048/compact-recovery";

const RATE_LIMIT_HEADERS = {
  "RateLimit-Limit": { description: "Maximum requests permitted in the current quota window", schema: { type: "integer" } },
  "RateLimit-Remaining": { description: "Requests remaining in the current quota window", schema: { type: "integer" } },
  "RateLimit-Reset": { description: "Quota-window reset time as Unix epoch seconds", schema: { type: "integer" } },
  "RateLimit-Scope": { description: "Quota identity class without exposing the identity", schema: { type: "string", enum: ["api-key", "account", "ip"] } },
  "RateLimit-Tier": { description: "Resolved account tier when the quota is account- or guest-scoped", schema: { type: "string", enum: ["guest", "authed", "paid"] } }
} as const;

const RATE_LIMITED_PARAMETERS = [{
  name: "x-api-key",
  in: "header",
  required: false,
  description: "Server-issued bot API key; invalid or missing keys use the IP fallback quota",
  schema: { type: "string" }
}] as const;

const OPENAPI_BASE_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Binary-2048 API",
    version: "0.1.0",
    description: "API for Binary-2048 gameplay, simulation, and AI-oriented helpers."
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/jobs/{id}": {
      get: {
        summary: "Read a principal-bound research job; results expire after 24 hours",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-f0-9]{64}$" } }],
        responses: { "200": { description: "Owned job status and result when complete; Retry-After: 2" }, "401": { description: "Research credential required" }, "403": { description: "Credential lacks jobs:read" }, "404": { description: "Unknown, unowned, or expired job" }, "429": { description: "Polling quota exhausted" }, "503": { description: "Status unavailable" } }
      }
    },
    "/api/auth/dev-token": {
      post: {
        summary: "Dev-only auth bridge token minting helper (env-gated)",
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Dev auth token minted" },
          "404": { description: "Endpoint disabled" },
          "503": { description: "Auth bridge secret not configured" }
        }
      }
    },
    "/api/auth/entitlements/proof": {
      post: {
        summary: "Mint short-lived entitlement proof from signed auth bridge token",
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Entitlement proof minted" },
          "401": { description: "Invalid auth token" },
          "403": { description: "Authenticated user required" },
          "503": { description: "Proof issuance not configured" }
        }
      }
    },
    "/api/auth/bridge-token": {
      post: {
        summary: "Mint auth-bridge bearer token from authenticated Auth.js session",
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Auth bridge token minted" },
          "401": { description: "Authenticated session required" },
          "503": { description: "Auth bridge secret not configured" }
        }
      }
    },
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service healthy",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/ops/telemetry": {
      get: {
        summary: "Get authorized runtime-scoped route telemetry and anomaly flags",
        responses: {
          "200": { description: "Read-only telemetry snapshot" },
          "401": { description: "Server-verified admin authority required" }
        }
      }
    },
    "/api/ops/storage/status": {
      get: {
        summary: "Get authorized passive storage configuration status",
        responses: {
          "200": { description: "Passive status; performs no connectivity checks or writes" },
          "401": { description: "Server-verified admin authority required" }
        }
      }
    },
    "/api/ops/storage/smoke": {
      post: {
        summary: "Run authorized active storage write/read/delete smoke verification",
        responses: {
          "200": { description: "Active storage probe result" },
          "401": { description: "Server-verified admin authority required" },
          "500": { description: "Storage probe failed" }
        }
      }
    },
    "/api/ops/league/config": {
      get: {
        summary: "Get authorized read-only runtime league configuration",
        responses: {
          "200": { description: "Production and sandbox league configuration" },
          "401": { description: "Server-verified admin authority required" }
        }
      },
      post: {
        summary: "Mirror or promote authorized league configuration",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["mirror", "promote"] } } } } }
        },
        responses: {
          "200": { description: "League configuration mirrored or promoted" },
          "400": { description: "Unsupported configuration action" },
          "401": { description: "Server-verified admin authority required" }
        }
      }
    },
    "/api/ops/rate-limit/probe": {
      post: {
        summary: "Run an authorized shared rate-limit probe",
        parameters: [
          { name: "probeId", in: "query", required: true, schema: { type: "string", pattern: "^[a-f0-9]{32}$" } },
          ...RATE_LIMITED_PARAMETERS
        ],
        responses: {
          "200": { description: "Shared rate-limit probe result" },
          "400": { description: "Invalid probe identifier" },
          "401": { description: "Admin authority and valid bot API key required" },
          "503": { description: "Shared rate-limit store unavailable" }
        }
      }
    },
    "/api/ops/storage/leaderboard-probe": {
      post: {
        summary: "Run an authorized leaderboard storage probe",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["action", "probeId"], properties: { action: { type: "string", enum: ["write", "read", "delete"] }, probeId: { type: "string", pattern: "^[a-f0-9]{32}$" } } } } }
        },
        responses: {
          "200": { description: "Leaderboard storage probe result" },
          "400": { description: "Invalid action or probe identifier" },
          "401": { description: "Server-verified admin authority required" },
          "503": { description: "Leaderboard storage probe failed" }
        }
      }
    },
    "/api/ops/leaderboard": {
      get: {
        summary: "Get authorized read-only leaderboard operations data",
        parameters: [
          { name: "namespace", in: "query", required: false, schema: { type: "string", enum: ["production", "sandbox"] } },
          { name: "seasonMode", in: "query", required: false, schema: { type: "string", enum: ["live", "preview"] } },
          { name: "practice", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } }
        ],
        responses: {
          "200": { description: "Leaderboard page with explicit backend and scope" },
          "401": { description: "Server-verified admin authority required" },
          "503": { description: "Leaderboard operations data unavailable" }
        }
      }
    },
    "/api/ops/models": {
      get: {
        summary: "Get authorized read-only runtime model registry data",
        responses: {
          "200": { description: "Registered model records with explicit runtime scope" },
          "401": { description: "Server-verified admin authority required" }
        }
      }
    },
    "/api/user/data/export": {
      get: {
        summary: "Export authenticated user data package",
        responses: {
          "200": { description: "User data export" },
          "401": { description: "Authenticated user required" }
        }
      }
    },
    "/api/user/data": {
      delete: {
        summary: "Delete authenticated user data package",
        responses: {
          "200": { description: "User data deleted" },
          "401": { description: "Authenticated user required" }
        }
      }
    },
    "/api/leaderboard": {
      get: {
        summary: "List ranked leaderboard entries",
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } }
        ],
        responses: {
          "200": { description: "Leaderboard entries" }
        }
      }
    },
    "/api/leaderboard/submit": {
      post: {
        summary: "Submit finished ranked game to leaderboard (server-authoritative)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Leaderboard entry submitted" },
          "400": { description: "Missing game id" },
          "401": { description: "Authenticated user required" },
          "403": { description: "Session not eligible" },
          "404": { description: "Game not found" },
          "409": { description: "Game not finished" }
        }
      }
    },
    "/api/bots/tournament": {
      post: {
        summary: "Run server-side AI-vs-AI tournament for configured seeds",
        parameters: RATE_LIMITED_PARAMETERS,
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object", properties: {
            seeds: { type: "array", maxItems: 100, items: { type: "integer" } },
            seedStart: { type: "integer" },
            seedCount: { type: "integer", minimum: 1, maximum: 100 },
            maxMoves: { type: "integer", minimum: 1, maximum: 2000 },
            bots: { type: "array", items: { type: "string", enum: ["priority", "random", "alternate", "rollout"] } },
            includeTraces: { type: "boolean" }
          } } } }
        },
        responses: {
          "202": { description: "Queued on isolated compute; poll statusUrl until complete or failed", content: { "application/json": { schema: { type: "object", required: ["jobId", "status", "statusUrl"], properties: { jobId: { type: "string" }, status: { const: "queued" }, statusUrl: { type: "string" } } } } } },
          "200": { description: "Tournament result with ranking and run summaries", headers: RATE_LIMIT_HEADERS },
          "400": { description: "Invalid tournament payload" },
          "401": { description: "Research credential required" },
          "403": { description: "Credential lacks tournament:run or configured anti-abuse challenge required" },
          "413": { description: "Tournament body exceeds 128 KiB" },
          "429": { description: "Rate limit or worker budget exceeded", headers: { ...RATE_LIMIT_HEADERS, "Retry-After": { description: "Seconds until retry is allowed", schema: { type: "integer" } } } },
          "503": { description: "Endpoint disabled, tournament capacity reached, or queue wait timed out" }
        }
      }
    },
    "/api/matches/same-seed": {
      post: {
        summary: "Create async same-seed PvP match",
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Match created" },
          "400": { description: "Invalid payload" }
        }
      }
    },
    "/api/matches/{id}": {
      get: {
        summary: "Get async match details and standings",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Match found" },
          "404": { description: "Match not found" }
        }
      }
    },
    "/api/matches/{id}/submit": {
      post: {
        summary: "Submit moves for async same-seed PvP match",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Submission accepted" },
          "400": { description: "Invalid submission payload" },
          "404": { description: "Match not found" }
        }
      }
    },
    "/api/marketing/track": {
      post: {
        summary: "Track marketing/share CTA events",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Marketing event tracked" },
          "400": { description: "Invalid marketing payload" }
        }
      }
    },
    "/api/marketing/events": {
      get: {
        summary: "List tracked marketing events",
        parameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer" } }],
        responses: {
          "200": { description: "Tracked marketing events" }
        }
      }
    },
    "/api/subscriptions": {
      get: {
        summary: "List notification subscriptions for a subscriber",
        parameters: [{ name: "subscriberId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Subscription list" },
          "400": { description: "Missing subscriber id" }
        }
      },
      post: {
        summary: "Create or update notification subscription",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Subscription upserted" },
          "400": { description: "Invalid payload" },
          "403": { description: "Requested topics denied for current user tier" }
        }
      },
      delete: {
        summary: "Delete notification subscription by id",
        parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Subscription deleted" },
          "400": { description: "Missing id" },
          "404": { description: "Subscription not found" }
        }
      }
    },
    "/api/store/inventory": {
      get: {
        summary: "Get store inventory and recent ledger entries",
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer" } }
        ],
        responses: {
          "200": { description: "Inventory and ledger" },
          "400": { description: "Invalid query" },
          "401": { description: "Authenticated bearer token required" },
          "403": { description: "Requested subscriber does not match authenticated account" }
        }
      },
      post: {
        summary: "Grant inventory to subscriber",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Inventory granted" },
          "400": { description: "Invalid payload" },
          "401": { description: "Server-verified admin authority required" }
        }
      }
    },
    "/api/store/catalog": {
      get: {
        summary: "List active paid packet SKUs",
        responses: {
          "200": { description: "Store packet catalog" }
        }
      }
    },
    "/api/store/purchase": {
      post: {
        summary: "Purchase a paid packet SKU and grant inventory bundle",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Packet purchased and inventory granted" },
          "400": { description: "Invalid purchase payload" },
          "401": { description: "Authenticated bearer token required" },
          "503": { description: "Direct purchase disabled until verified checkout is configured" }
        }
      }
    },
    "/api/store/consume": {
      post: {
        summary: "Consume inventory for subscriber and append ledger entry",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Inventory consumed" },
          "400": { description: "Invalid consume payload or insufficient balance" },
          "401": { description: "Authenticated bearer token required" }
        }
      }
    },
    "/api/store/webhook": {
      post: {
        summary: "Process a signed Stripe store webhook",
        parameters: [{ name: "stripe-signature", in: "header", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Webhook processed or previously processed" },
          "400": { description: "Invalid signature or webhook event" },
          "503": { description: "Store webhook is not configured" }
        }
      }
    },
    "/api/ads/reward": {
      post: {
        summary: "Grant rewarded-ad inventory after server-side signature and anti-fraud checks",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Reward granted" },
          "400": { description: "Invalid payload" },
          "401": { description: "Invalid reward signature" },
          "403": { description: "Ad rewards disabled or paid-tier blocked" },
          "409": { description: "Replay nonce detected" },
          "429": { description: "Cooldown or daily cap reached" }
        }
      }
    },
    "/api/games": {
      post: {
        summary: "Create a game session",
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Game created" },
          "400": { description: "Invalid request" }
        }
      }
    },
    "/api/games/{id}": {
      get: {
        summary: "Get game state by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Game found" },
          "404": { description: "Game not found" }
        }
      }
    },
    "/api/games/{id}/move": {
      post: {
        summary: "Apply one move",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          ...RATE_LIMITED_PARAMETERS
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  dir: { type: "string", enum: ["up", "down", "left", "right"] },
                  action: { type: "string", enum: ["U", "D", "L", "R"] },
                  syncVersion: { type: "string", const: COMPACT_SYNC_VERSION },
                  expectTurn: { type: "integer", minimum: 0 },
                  expectStateHashVersion: { type: "string", const: STATE_HASH_VERSION },
                  expectStateHash: { type: "string", pattern: "^[0-9a-f]{8}$" },
                  recoverySnapshot: { type: "object" },
                  compactRecovery: {
                    type: "object",
                    description: "Trusted signed checkpoint plus at most 24 acknowledged directions; accepted only after session loss",
                    properties: {
                      version: { type: "string", const: COMPACT_RECOVERY_VERSION },
                      checkpoint: { type: "object" },
                      acknowledgedTail: {
                        type: "array",
                        maxItems: 24,
                        items: { type: "string", enum: ["up", "down", "left", "right"] }
                      }
                    }
                  }
                },
                anyOf: [{ required: ["dir"] }, { required: ["action"] }]
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Move applied with versioned authoritative state identity; compact clients receive a signed recovery checkpoint every 25 persisted moves, on recovery, and at terminal state",
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["current", "stateHash", "stateHashVersion"],
                  properties: {
                    current: { type: "object" },
                    stateHash: { type: "string", pattern: "^[0-9a-f]{8}$" },
                    stateHashVersion: { type: "string", const: STATE_HASH_VERSION },
                    sync: {
                      type: "object",
                      properties: {
                        version: { type: "string", const: COMPACT_SYNC_VERSION },
                        checkpoint: { type: "boolean" },
                        checkpointStep: { type: ["integer", "null"] },
                        checkpointInterval: { type: "integer", const: 25 }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": { description: "Invalid move or unsupported explicit state-hash/compact-sync version" },
          "404": { description: "Game not found" },
          "409": { description: "State-hash precondition or persistence conflict" },
          "429": {
            description: "Gameplay move rate limit exceeded",
            headers: {
              ...RATE_LIMIT_HEADERS,
              "Retry-After": { description: "Seconds until retry is allowed", schema: { type: "integer" } }
            }
          },
          "503": { description: "Session storage temporarily unavailable" }
        }
      }
    },
    "/api/games/{id}/undo": {
      post: {
        summary: "Undo the last move",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Undo applied" },
          "400": { description: "Undo unavailable" },
          "404": { description: "Game not found" }
        }
      }
    },
    "/api/games/{id}/encoded": {
      get: {
        summary: "Get AI-friendly encoded state",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Encoded state" },
          "404": { description: "Game not found" }
        }
      }
    },
    "/api/games/{id}/export": {
      get: {
        summary: "Export game JSON",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "compact", in: "query", required: false, schema: { type: "string" } },
          { name: "audit", in: "query", required: false, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Export JSON" },
          "404": { description: "Game not found" }
        }
      },
      post: {
        summary: "Recover a missing session and export game JSON",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "compact", in: "query", required: false, schema: { type: "string" } },
          { name: "audit", in: "query", required: false, schema: { type: "string" } }
        ],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object", properties: { recoverySnapshot: { type: "object" }, compactRecovery: { type: "object" } } } } }
        },
        responses: {
          "200": { description: "Recovered export JSON" },
          "400": { description: "Invalid recovery payload" },
          "404": { description: "Game not found" }
        }
      }
    },
    "/api/games/{id}/replay": {
      get: {
        summary: "Get canonical replay payload (header + moves)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Replay payload" },
          "404": { description: "Game not found" }
        }
      }
    },
    "/api/games/import": {
      post: {
        summary: "Import game JSON",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Imported" },
          "400": { description: "Invalid import payload" },
          "413": { description: "Import body exceeds 256 KiB" }
        }
      }
    },
    "/api/sim/run": {
      post: {
        summary: "Run deterministic scenario",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Scenario result" },
          "400": { description: "Invalid scenario payload" },
          "413": { description: "Scenario body exceeds 128 KiB" }
        }
      }
    },
    "/api/simulate": {
      post: {
        summary: "Batch simulation endpoint",
        parameters: RATE_LIMITED_PARAMETERS,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Simulation result", headers: RATE_LIMIT_HEADERS },
          "400": { description: "Invalid simulation payload" },
          "401": { description: "Research credential required" },
          "403": { description: "Credential lacks simulation:run or configured anti-abuse challenge required" },
          "413": { description: "Simulation body exceeds 128 KiB" },
          "429": { description: "Rate limit exceeded", headers: { ...RATE_LIMIT_HEADERS, "Retry-After": { description: "Seconds until retry is allowed", schema: { type: "integer" } } } },
          "503": { description: "Endpoint temporarily disabled by degrade mode" }
        }
      }
    },
    "/api/training/replays": {
      get: {
        summary: "Generate deterministic bot replay summaries for training",
        parameters: [
          ...RATE_LIMITED_PARAMETERS,
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "bot", in: "query", required: false, schema: { type: "string", enum: ["priority", "random", "alternate", "rollout"], default: "rollout" } },
          { name: "minScore", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } }
        ],
        responses: {
          "202": { description: "Queued on isolated compute; poll statusUrl until complete or failed", content: { "application/json": { schema: { type: "object", required: ["jobId", "status", "statusUrl"], properties: { jobId: { type: "string" }, status: { const: "queued" }, statusUrl: { type: "string" } } } } } },
          "200": { description: "Paginated replay summaries", headers: RATE_LIMIT_HEADERS },
          "401": { description: "Research credential required" },
          "403": { description: "Credential lacks training:read or configured anti-abuse challenge required" },
          "429": { description: "Shared training rate limit exceeded", headers: { ...RATE_LIMIT_HEADERS, "Retry-After": { description: "Seconds until retry is allowed", schema: { type: "integer" } } } },
          "500": { description: "Training replay generation failed" },
          "503": { description: "Training queue full or wait timeout", headers: { "Retry-After": { description: "Seconds before retrying capacity", schema: { type: "integer" } } } }
        }
      }
    },
    "/api/training/labels": {
      get: {
        summary: "Generate labeled board states for training",
        parameters: [
          ...RATE_LIMITED_PARAMETERS,
          { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          { name: "strategy", in: "query", required: false, schema: { type: "string", enum: ["score_delta", "rollout"], default: "score_delta" } },
          { name: "minTile", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } }
        ],
        responses: {
          "202": { description: "Queued on isolated compute; poll statusUrl until complete or failed", content: { "application/json": { schema: { type: "object", required: ["jobId", "status", "statusUrl"], properties: { jobId: { type: "string" }, status: { const: "queued" }, statusUrl: { type: "string" } } } } } },
          "200": { description: "Paginated labeled board states", headers: RATE_LIMIT_HEADERS },
          "401": { description: "Research credential required" },
          "403": { description: "Credential lacks training:read or configured anti-abuse challenge required" },
          "429": { description: "Shared training rate limit exceeded", headers: { ...RATE_LIMIT_HEADERS, "Retry-After": { description: "Seconds until retry is allowed", schema: { type: "integer" } } } },
          "500": { description: "Training label generation failed" },
          "503": { description: "Training queue full or wait timeout", headers: { "Retry-After": { description: "Seconds before retrying capacity", schema: { type: "integer" } } } }
        }
      }
    },
    "/api/replay": {
      post: {
        summary: "Deterministically reconstruct replay from export or replay payload",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Replay reconstruction result" },
          "400": { description: "Invalid replay payload" },
          "413": { description: "Replay body exceeds 128 KiB" }
        }
      }
    },
    "/api/replay/ingest": {
      post: {
        summary: "Ingest canonical run records for replay research",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["records"], properties: { records: { type: "array", minItems: 1, maxItems: 100, items: { type: "object" } } } } } }
        },
        responses: {
          "200": { description: "Canonical run records ingested with duplicate ids reported" },
          "400": { description: "A valid 1..100 canonical-record array is required" },
          "401": { description: "Research credential required" },
          "403": { description: "Credential lacks replay:ingest" },
          "413": { description: "Request exceeds 1 MiB" },
          "429": { description: "Replay-ingest quota exhausted" }
        }
      }
    },
    "/api/replay/validate": {
      post: {
        summary: "Validate replay payload compatibility and deterministic rerun",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Replay validation result { ok, reason, details? }" },
          "400": { description: "Invalid JSON payload" }
        }
      }
    },
    "/api/replay/code": {
      post: {
        summary: "Create shareable replay code from replay payload",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } }
          }
        },
        responses: {
          "200": { description: "Replay code created" },
          "400": { description: "Invalid replay payload" }
        }
      },
      get: {
        summary: "Decode shareable replay code back to compact replay payload",
        parameters: [{ name: "code", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Replay payload" },
          "400": { description: "Invalid replay code" }
        }
      }
    },
    "/api/replay/postmortem": {
      post: {
        summary: "Replay postmortem analyzer for highest-cost moves",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Replay postmortem result" },
          "400": { description: "Invalid replay payload" },
          "413": { description: "Replay body exceeds 128 KiB" }
        }
      }
    },
    "/api/challenges/daily": {
      get: {
        summary: "Get Bitstorm Daily challenge and daily leaderboard window",
        responses: {
          "200": { description: "Daily challenge payload" }
        }
      }
    },
    "/api/challenges/daily/submit": {
      post: {
        summary: "Submit replay for Bitstorm Daily leaderboard",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Daily replay submission result" },
          "400": { description: "Invalid submission payload" }
        }
      }
    },
    "/api/challenges/ghost-race": {
      get: {
        summary: "Get ghost race challenge (rollout bot replay on selected seed)",
        responses: {
          "200": { description: "Ghost race challenge payload" }
        }
      }
    },
    "/api/challenges/ghost-race/submit": {
      post: {
        summary: "Submit replay for ghost race comparison",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Ghost race submission result" },
          "400": { description: "Invalid submission payload" }
        }
      }
    },
    "/api/runs/{id}": {
      get: {
        summary: "Get canonical persisted run record by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Canonical run record" },
          "404": { description: "Run not found" }
        }
      }
    },
    "/api/runs/{id}/replay": {
      get: {
        summary: "Get persisted compact replay payload for run id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Compact replay payload" },
          "404": { description: "Run replay not found" }
        }
      }
    },
    "/api/openapi": {
      get: {
        summary: "OpenAPI spec document",
        responses: {
          "200": {
            description: "OpenAPI JSON",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    }
  }
} as const;

type OperationContract = {
  auth: string;
  security: ReadonlyArray<Record<string, readonly string[]>>;
  scopes: readonly string[];
  rateLimit: string;
  version: string;
  examples: { request?: string; response: string };
};

const PUBLIC: Pick<OperationContract, "auth" | "security" | "scopes"> = {
  auth: "Public; no credential is required",
  security: [],
  scopes: []
};

const OPTIONAL_API_KEY: Pick<OperationContract, "auth" | "security" | "scopes"> = {
  auth: "Optional x-api-key; missing or invalid keys use the IP/account quota",
  security: [{ botApiKey: [] }, {}],
  scopes: []
};

const SCOPED_RESEARCH = (scope: string): Pick<OperationContract, "auth" | "security" | "scopes"> => ({
  auth: `Scoped x-api-key (${scope}), configured research subject, or admin authority required`,
  security: [{ botApiKey: [] }, { bearerAuth: [] }, { adminServiceToken: [] }],
  scopes: [scope]
});

const OPERATION_CONTRACTS: Record<string, OperationContract> = {
  "GET /api/jobs/{id}": { ...SCOPED_RESEARCH("jobs:read"), auth: "Scoped research/admin credential bound to the submitting principal; ownerless pre-deployment jobs retain opaque-id access until their 24-hour TTL", rateLimit: "job_status: default 120 requests / 5 minutes", version: "job-v1", examples: { response: "{ jobId, status, result?, error?, expiresAt }" } },
  "POST /api/games": { ...PUBLIC, rateLimit: "No route-local request quota", version: "session-schema-v2", examples: { request: "{ seed?: 42, mode?: 'normal' }", response: "{ id, current, recoverySnapshot, integrity }" } },
  "GET /api/games/{id}": { ...PUBLIC, rateLimit: "No route-local request quota", version: "session-schema-v2", examples: { response: "{ id, current, recoverySnapshot, integrity }" } },
  "POST /api/games/{id}/move": { ...OPTIONAL_API_KEY, rateLimit: "game_move: default 600 requests / 5 minutes; API-key counters are shared", version: COMPACT_SYNC_VERSION, examples: { request: "{ dir: 'left', expectTurn, expectStateHashVersion, expectStateHash }", response: "{ current, stateHash, stateHashVersion, sync }" } },
  "POST /api/games/{id}/undo": { ...PUBLIC, rateLimit: "No route-local request quota", version: "session-schema-v2", examples: { response: "{ current, undo, recoverySnapshot }" } },
  "GET /api/games/{id}/encoded": { ...PUBLIC, rateLimit: "No route-local request quota", version: "encoded-state-v1", examples: { response: "{ encoded, encodedFlat, actionMask }" } },
  "GET /api/games/{id}/export": { ...PUBLIC, rateLimit: "No route-local request quota", version: "game-export-v1", examples: { response: "Versioned game export or compact replay" } },
  "POST /api/games/{id}/export": { ...PUBLIC, rateLimit: "No route-local request quota", version: COMPACT_RECOVERY_VERSION, examples: { request: "{ compactRecovery }", response: "Recovered versioned game export" } },
  "GET /api/games/{id}/replay": { ...PUBLIC, rateLimit: "No route-local request quota", version: "replay-v1", examples: { response: "{ header, moves, signature? }" } },
  "POST /api/games/import": { ...PUBLIC, rateLimit: "No route-local request quota; body capped at 256 KiB", version: COMPACT_RECOVERY_VERSION, examples: { request: "Game export, recovery snapshot, or compact recovery", response: "{ id, current, recoverySnapshot, steps, integrity }" } },
  "POST /api/sim/run": { ...PUBLIC, rateLimit: "No route-local request quota; body capped at 128 KiB", version: "simulation-v1", examples: { request: "{ config, initialGrid, moves }", response: "{ version: 1, final, steps }" } },
  "POST /api/simulate": { ...SCOPED_RESEARCH("simulation:run"), rateLimit: "simulate: default 60 requests / 5 minutes; 128 KiB body; maximum 2,000 moves; challenge policy applies", version: "simulation-v1", examples: { request: "{ moves: ['L', 'U'], seed: 42 }", response: "Simulation result" } },
  "POST /api/bots/tournament": { ...SCOPED_RESEARCH("tournament:run"), rateLimit: "bots_tournament: default 10 requests / 5 minutes; 128 KiB body; maximum 100 seeds, 2,000 moves/run, 25,000 aggregate decisions, and 2,500 trace decisions; challenge policy applies", version: "tournament-v1", examples: { request: "{ seedCount: 3, maxMoves: 250, bots: ['priority', 'rollout'] }", response: "Tournament result or { jobId, status, statusUrl }" } },
  "GET /api/training/replays": { ...SCOPED_RESEARCH("training:read"), rateLimit: "training: shared default 20 requests / 5 minutes; limit 1..100; challenge policy applies", version: "training-replays-v1", examples: { response: "Replay page or { jobId, status, statusUrl }" } },
  "GET /api/training/labels": { ...SCOPED_RESEARCH("training:read"), rateLimit: "training: shared default 20 requests / 5 minutes; limit 1..500; challenge policy applies", version: "training-labels-v1", examples: { response: "Label page or { jobId, status, statusUrl }" } },
  "GET /api/ops/models": { auth: "Admin bearer token or signed admin auth-bridge token", security: [{ adminBearer: [] }], scopes: ["admin"], rateLimit: "No route-local request quota", version: "model-registry-v1", examples: { response: "{ source, models }" } },
  "POST /api/replay": { ...PUBLIC, rateLimit: "No route-local request quota; body capped at 128 KiB", version: "replay-v1", examples: { request: "Versioned game export or replay envelope", response: "Deterministically reconstructed replay" } },
  "POST /api/replay/ingest": { ...SCOPED_RESEARCH("replay:ingest"), rateLimit: "replay_ingest: default 10 requests / 5 minutes; 1 MiB body and 100 records/request", version: "canonical-run-v1", examples: { request: "{ records: [canonicalRunRecord] }", response: "{ ingested, duplicateIds }" } },
  "POST /api/replay/validate": { ...PUBLIC, rateLimit: "No route-local request quota", version: "replay-v1", examples: { request: "{ payload, signature? }", response: "{ ok, reason, details? }" } },
  "GET /api/replay/code": { ...PUBLIC, rateLimit: "No route-local request quota", version: "replay-code-v1", examples: { response: "Decoded compact replay payload" } },
  "POST /api/replay/code": { ...PUBLIC, rateLimit: "No route-local request quota", version: "replay-code-v1", examples: { request: "Compact replay payload", response: "{ code, length, signed, hosted }" } },
  "POST /api/replay/postmortem": { ...PUBLIC, rateLimit: "No route-local request quota; body capped at 128 KiB", version: "replay-v1", examples: { request: "Versioned game export or replay envelope", response: "Ranked highest-cost move analysis" } },
  "GET /api/runs/{id}": { ...PUBLIC, rateLimit: "No route-local request quota", version: "canonical-run-v1", examples: { response: "Canonical persisted run record" } },
  "GET /api/runs/{id}/replay": { ...PUBLIC, rateLimit: "No route-local request quota", version: "replay-v1", examples: { response: "Compact replay envelope for the persisted run" } }
};

const OPENAPI_COMPONENTS = {
  securitySchemes: {
    botApiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "Server-issued bot key. Quota identity and configured authorization scopes are evaluated separately." },
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Binary2048 auth-bridge JWT" },
    adminBearer: { type: "http", scheme: "bearer", bearerFormat: "Admin token or signed admin auth-bridge JWT" },
    adminServiceToken: { type: "apiKey", in: "header", name: "x-admin-token", description: "Operator-only admin service credential" },
    authSession: { type: "apiKey", in: "cookie", name: "next-auth.session-token", description: "Auth.js browser session cookie" }
  },
  schemas: {
    Error: { type: "object", required: ["error"], properties: { error: { type: "string" }, code: { type: "string" }, details: { type: "object" } }, additionalProperties: true },
    ValidationFailure: { type: "object", required: ["ok", "reason"], properties: { ok: { const: false }, reason: { type: "string" }, details: { type: "object" } }, additionalProperties: true },
    ApiFailure: { oneOf: [{ "$ref": "#/components/schemas/Error" }, { "$ref": "#/components/schemas/ValidationFailure" }] },
    RateLimitError: { type: "object", required: ["error"], properties: { error: { type: "string" }, route: { type: "string" }, limit: { type: "integer" }, remaining: { type: "integer" }, retryAfterSeconds: { type: "integer" } } },
    JobAccepted: { type: "object", required: ["jobId", "status", "statusUrl"], properties: { jobId: { type: "string" }, status: { const: "queued" }, statusUrl: { type: "string" } } },
    StateIdentity: { type: "object", required: ["stateHash", "stateHashVersion"], properties: { stateHash: { type: "string", pattern: "^[0-9a-f]{8}$" }, stateHashVersion: { type: "string", const: STATE_HASH_VERSION } } },
    ReplayEnvelope: { type: "object", required: ["header", "moves"], properties: { header: { type: "object" }, moves: { type: "array", items: { type: "string", enum: ["L", "R", "U", "D"] } }, signature: { type: "string" } } }
  }
} as const;

function enrichOpenApi<T extends { paths: Record<string, Record<string, unknown>> }>(base: T) {
  const paths = Object.fromEntries(Object.entries(base.paths).map(([path, item]) => [
    path,
    Object.fromEntries(Object.entries(item).map(([method, operation]) => {
      const policy = OPERATION_CONTRACTS[`${method.toUpperCase()} ${path}`];
      if (!policy || !operation || typeof operation !== "object") return [method, operation];
      const operationRecord = operation as Record<string, unknown>;
      const requestBody = operationRecord.requestBody && typeof operationRecord.requestBody === "object" && policy.examples.request
        ? (() => {
            const body = operationRecord.requestBody as Record<string, unknown>;
            const content = body.content && typeof body.content === "object" ? body.content as Record<string, unknown> : {};
            const json = content["application/json"] && typeof content["application/json"] === "object" ? content["application/json"] as Record<string, unknown> : {};
            return { ...body, content: { ...content, "application/json": { ...json, examples: { illustrative: { value: policy.examples.request } } } } };
          })()
        : operationRecord.requestBody;
      const sourceResponses = operationRecord.responses && typeof operationRecord.responses === "object"
        ? operationRecord.responses as Record<string, unknown>
        : {};
      let successExampleApplied = false;
      const responses = Object.fromEntries(Object.entries(sourceResponses).map(([status, response]) => {
        if (!response || typeof response !== "object") return [status, response];
        const responseRecord = response as Record<string, unknown>;
        if (/^[45]/.test(status)) {
          const schema = status === "429"
            ? { "$ref": "#/components/schemas/RateLimitError" }
            : { "$ref": "#/components/schemas/ApiFailure" };
          return [status, { ...responseRecord, content: responseRecord.content ?? { "application/json": { schema } } }];
        }
        if (!successExampleApplied && /^2/.test(status)) {
          successExampleApplied = true;
          const content = responseRecord.content && typeof responseRecord.content === "object" ? responseRecord.content as Record<string, unknown> : {};
          const json = content["application/json"] && typeof content["application/json"] === "object" ? content["application/json"] as Record<string, unknown> : {};
          return [status, { ...responseRecord, content: { ...content, "application/json": { ...json, examples: { illustrative: { value: policy.examples.response } } } } }];
        }
        return [status, response];
      }));
      return [method, {
        ...operation,
        requestBody,
        responses,
        security: policy.security,
        "x-auth-description": policy.auth,
        "x-required-scopes": policy.scopes,
        "x-rate-limit-policy": policy.rateLimit,
        "x-api-version": policy.version,
        "x-safe-examples": policy.examples
      }];
    }))
  ]));
  return { ...base, paths, components: OPENAPI_COMPONENTS } as T & { paths: typeof paths; components: typeof OPENAPI_COMPONENTS };
}

export const OPENAPI_SPEC = enrichOpenApi(OPENAPI_BASE_SPEC);
