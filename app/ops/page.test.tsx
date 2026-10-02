import { renderToStaticMarkup } from "react-dom/server";
import OpsPage from "./page";
import { getRequiredServerSession } from "@/lib/binary2048/server-session";
import { getFleetTelemetry } from "@/lib/binary2048/ops-telemetry";

jest.mock("./ops.css", () => ({}));
jest.mock("@/lib/binary2048/server-session", () => ({ getRequiredServerSession: jest.fn() }));
jest.mock("@/lib/binary2048/ops-telemetry", () => ({ getFleetTelemetry: jest.fn() }));
jest.mock("@/lib/binary2048/league-config", () => ({ getLeagueConfig: jest.fn(async () => ({ rulesetId: "binary2048-v1", seedPoolId: "seeds", maxMoves: 500, undoLimit: 0 })) }));
jest.mock("@/lib/binary2048/model-registry", () => ({ listRegisteredModels: jest.fn(async () => []) }));
jest.mock("@/lib/binary2048/leaderboard", () => ({ getLeaderboardPage: jest.fn(async () => ({ total: 0 })) }));

beforeEach(() => { jest.clearAllMocks(); process.env.BINARY2048_ADMIN_SUBJECTS = "operator@example.test"; });
afterAll(() => { delete process.env.BINARY2048_ADMIN_SUBJECTS; });
it("denies ordinary signed-in users before loading operations data", async () => {
  jest.mocked(getRequiredServerSession).mockResolvedValue({ user: { email: "player@example.test" }, expires: "2099-01-01" });
  const html = renderToStaticMarkup(await OpsPage());
  expect(html).toContain("Operator access required");
  expect(getFleetTelemetry).not.toHaveBeenCalled();
});
it("shows missing telemetry explicitly and renders accessible read-only sections", async () => {
  jest.mocked(getRequiredServerSession).mockResolvedValue({ user: { email: "operator@example.test" }, expires: "2099-01-01" });
  jest.mocked(getFleetTelemetry).mockResolvedValue({ available: false, complete: false, stale: true, generatedAtISO: null, routes: [] });
  const html = renderToStaticMarkup(await OpsPage());
  expect(html).toContain("Waiting for the first aggregate");
  expect(html).toContain('scope="col"');
  expect(html).toContain('aria-labelledby="ops-storage"');
  expect(html).toContain("Refresh data");
  expect(html).not.toContain("x-admin-token");
});
