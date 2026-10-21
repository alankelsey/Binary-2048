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
});
