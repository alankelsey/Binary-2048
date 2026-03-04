import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

describe("OPENAPI_SPEC", () => {
  it("contains expected core gameplay routes", () => {
    expect(OPENAPI_SPEC.paths["/api/games"]?.post?.summary).toBe("Create a game session");
    expect(OPENAPI_SPEC.paths["/api/games/{id}"]?.get?.summary).toBe("Get game state by id");
    expect(OPENAPI_SPEC.paths["/api/games/{id}/move"]?.post?.summary).toBe("Apply one move");
    expect(OPENAPI_SPEC.paths["/api/games/{id}/undo"]?.post?.summary).toBe("Undo the last move");
  });

  it("contains expected AI and docs routes", () => {
    expect(OPENAPI_SPEC.paths["/api/auth/dev-token"]?.post?.summary).toContain("Dev-only auth bridge token");
    expect(OPENAPI_SPEC.paths["/api/auth/entitlements/proof"]?.post?.summary).toContain("Mint short-lived entitlement proof");
    expect(OPENAPI_SPEC.paths["/api/games/{id}/encoded"]?.get?.summary).toBe("Get AI-friendly encoded state");
    expect(OPENAPI_SPEC.paths["/api/games/{id}/replay"]?.get?.summary).toContain("canonical replay payload");
    expect(OPENAPI_SPEC.paths["/api/simulate"]?.post?.summary).toBe("Batch simulation endpoint");
    expect(OPENAPI_SPEC.paths["/api/replay"]?.post?.summary).toContain("Deterministically reconstruct replay");
    expect(OPENAPI_SPEC.paths["/api/replay/code"]?.post?.summary).toContain("Create shareable replay code");
    expect(OPENAPI_SPEC.paths["/api/replay/code"]?.get?.summary).toContain("Decode shareable replay code");
    expect(OPENAPI_SPEC.paths["/api/openapi"]?.get?.summary).toBe("OpenAPI spec document");
    expect(OPENAPI_SPEC.paths["/api/health"]?.get?.summary).toBe("Health check");
  });
});
