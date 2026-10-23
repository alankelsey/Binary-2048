import { GET } from "@/app/api/jobs/[id]/result/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { createHash } from "crypto";

const findOne = jest.fn();
jest.mock("@/lib/binary2048/worker-jobs", () => ({
  workerJobsEnabled: () => true,
  workerCollections: async () => ({ jobs: { findOne } })
}));

const jobId = "b".repeat(64);
const context = { params: Promise.resolve({ id: jobId }) };

describe("GET /api/jobs/{id}/result", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStore();
    process.env.BINARY2048_BOT_API_KEY_HASHES = `reader=${createHash("sha256").update("reader-key").digest("hex")}`;
    process.env.BINARY2048_BOT_API_KEY_SCOPES = "reader=jobs:read";
  });
  afterAll(() => {
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_BOT_API_KEY_SCOPES;
  });

  it("returns the completed result to its owner", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      owner: "api-key:reader",
      status: "complete",
      attempts: 1,
      result: { ok: true },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}/result`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ jobId, status: "complete", result: { ok: true } });
  });

  it("returns 202 without exposing a pending task", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      owner: "api-key:reader",
      status: "running",
      attempts: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      leaseUntil: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}/result`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(response.status).toBe(202);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(await response.json()).toMatchObject({ jobId, status: "running" });
  });

  it("hides a result owned by another principal", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      owner: "api-key:other",
      status: "complete",
      attempts: 1,
      result: { secret: true },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}/result`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(response.status).toBe(404);
  });
});
