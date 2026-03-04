export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Binary-2048 API",
    version: "0.1.0",
    description: "API for Binary-2048 gameplay, simulation, and AI-oriented helpers."
  },
  servers: [{ url: "/" }],
  paths: {
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
          { name: "subscriberId", in: "query", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", required: false, schema: { type: "integer" } }
        ],
        responses: {
          "200": { description: "Inventory and ledger" },
          "400": { description: "Invalid query" }
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
          "400": { description: "Invalid payload" }
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
          "400": { description: "Invalid consume payload or insufficient balance" }
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
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Move applied" },
          "404": { description: "Game not found" }
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
          "400": { description: "Invalid import payload" }
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
          "400": { description: "Invalid scenario payload" }
        }
      }
    },
    "/api/simulate": {
      post: {
        summary: "Batch simulation endpoint",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Simulation result" },
          "400": { description: "Invalid simulation payload" }
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
          "400": { description: "Invalid replay payload" }
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
