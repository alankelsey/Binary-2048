import { getApiDocEntries } from "@/lib/binary2048/openapi-docs";

describe("getApiDocEntries", () => {
  it("returns path entries sorted lexicographically", () => {
    const entries = getApiDocEntries();
    const paths = entries.map((entry) => entry.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  it("returns operations in method order with fallback summary", () => {
    const entries = getApiDocEntries();
    const games = entries.find((entry) => entry.path === "/api/games");
    const health = entries.find((entry) => entry.path === "/api/health");

    expect(games?.operations.map((operation) => operation.method)).toEqual(["post"]);
    expect(games?.operations[0]?.summary).toBe("Create a game session");
    expect(health?.operations.map((operation) => operation.method)).toEqual(["get"]);
    expect(health?.operations[0]?.summary).toBe("Health check");
    expect(games?.operations[0]?.requestBody).toBe(true);
    expect(health?.operations[0]?.requestBody).toBe(false);
    expect(health?.operations[0]?.responses).toEqual([{ status: "200", description: "Service healthy" }]);
  });

  it("exposes audited operation policy metadata without inventing defaults", () => {
    const entries = getApiDocEntries();
    const simulate = entries.find((entry) => entry.path === "/api/simulate")?.operations[0];
    const health = entries.find((entry) => entry.path === "/api/health")?.operations[0];

    expect(simulate?.auth).toContain("Scoped x-api-key");
    expect(simulate?.rateLimit).toContain("60 requests / 5 minutes");
    expect(simulate?.version).toBe("simulation-job-v2");
    expect(simulate?.examples?.request).toContain("moves");
    expect(health?.auth).toBe("Not yet audited");
  });
});
