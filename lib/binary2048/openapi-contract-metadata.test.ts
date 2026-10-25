import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

const PRIORITY_OPERATIONS = [
  "GET /api/jobs/{id}",
  "GET /api/jobs/{id}/result",
  "POST /api/games", "GET /api/games/{id}", "POST /api/games/{id}/move",
  "POST /api/games/{id}/undo", "GET /api/games/{id}/encoded",
  "GET /api/games/{id}/export", "POST /api/games/{id}/export",
  "GET /api/games/{id}/replay", "POST /api/games/import",
  "POST /api/sim/run", "POST /api/simulate", "POST /api/bots/tournament",
  "GET /api/training/replays", "GET /api/training/labels", "GET /api/ops/models",
  "POST /api/replay", "POST /api/replay/ingest", "POST /api/replay/validate",
  "GET /api/replay/code", "POST /api/replay/code", "POST /api/replay/postmortem",
  "GET /api/runs/{id}", "GET /api/runs/{id}/replay"
] as const;

type AuditedOperation = {
  security?: unknown[];
  "x-auth-description"?: string;
  "x-required-scopes"?: string[];
  "x-rate-limit-policy"?: string;
  "x-api-version"?: string;
  "x-safe-examples"?: { request?: string; response?: string };
};

function operation(key: string) {
  const [method, routePath] = key.split(" ", 2);
  const pathItem = (OPENAPI_SPEC.paths as Record<string, Record<string, AuditedOperation>>)[routePath];
  return pathItem?.[method.toLowerCase()];
}

describe("priority OpenAPI operation contracts", () => {
  it.each(PRIORITY_OPERATIONS)("publishes audited metadata for %s", (key) => {
    const contract = operation(key);
    expect(contract).toBeDefined();
    expect(contract?.security).toBeDefined();
    expect(contract?.["x-auth-description"]).not.toMatch(/not yet audited/i);
    expect(contract?.["x-required-scopes"]).toBeDefined();
    expect(contract?.["x-rate-limit-policy"]).not.toMatch(/not yet audited/i);
    expect(contract?.["x-api-version"]).not.toMatch(/not yet audited/i);
    expect(contract?.["x-safe-examples"]?.response).toBeTruthy();
  });

  it("publishes reusable security and canonical response schemas", () => {
    expect(OPENAPI_SPEC.components.securitySchemes.botApiKey.name).toBe("x-api-key");
    expect(OPENAPI_SPEC.components.securitySchemes.adminBearer.scheme).toBe("bearer");
    expect(OPENAPI_SPEC.components.schemas.Error.required).toContain("error");
    expect(OPENAPI_SPEC.components.schemas.ApiFailure.oneOf).toHaveLength(2);
    expect(OPENAPI_SPEC.components.schemas.JobAccepted.required).toEqual(["jobId", "status", "statusUrl", "resultUrl"]);
    expect(OPENAPI_SPEC.components.schemas.StateIdentity.properties.stateHashVersion.const).toBe("fnv1a32-game-state-v2");
    expect(OPENAPI_SPEC.components.schemas.ReplayEnvelope.required).toEqual(["header", "moves"]);
  });

  it("places safe examples and shared failures in standard OpenAPI content", () => {
    const simulate = operation("POST /api/simulate") as AuditedOperation & {
      requestBody: { content: { "application/json": { examples: { illustrative: { value: string } } } } };
      responses: Record<string, { content: { "application/json": { schema?: { $ref: string }; examples?: { illustrative: { value: string } } } } }>;
    };
    expect(simulate.requestBody.content["application/json"].examples.illustrative.value).toContain("moves");
    expect(simulate.responses["200"].content["application/json"].examples?.illustrative.value).toContain("jobId");
    expect(simulate.responses["429"].content["application/json"].schema?.$ref).toBe("#/components/schemas/RateLimitError");
  });

  it("publishes enforced research authorization and keeps admin metadata", () => {
    expect(operation("POST /api/replay/ingest")?.security).toContainEqual({ botApiKey: [] });
    expect(operation("POST /api/replay/ingest")?.["x-required-scopes"]).toEqual(["replay:ingest"]);
    expect(operation("GET /api/jobs/{id}")?.["x-required-scopes"]).toEqual(["jobs:read"]);
    expect(operation("GET /api/jobs/{id}/result")?.["x-required-scopes"]).toEqual(["jobs:read"]);
    expect(operation("GET /api/jobs/{id}/result")?.["x-api-version"]).toBe("worker-result-v1");
    expect(operation("GET /api/ops/models")?.["x-required-scopes"]).toEqual(["admin"]);
    expect(operation("POST /api/simulate")?.["x-required-scopes"]).toEqual(["simulation:run"]);
  });
});
