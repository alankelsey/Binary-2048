import { GET } from "@/app/api/jobs/[id]/result/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { createHash } from "crypto";

const findOne = jest.fn();
const findArtifact = jest.fn();
jest.mock("@/lib/binary2048/worker-jobs", () => ({
  ...jest.requireActual("@/lib/binary2048/worker-jobs"),
  workerJobsEnabled: () => true,
  workerCollections: async () => ({ jobs: { findOne }, artifacts: { findOne: findArtifact } })
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
    expect(findArtifact).not.toHaveBeenCalled();
  });

  it("verifies and returns the persisted worker artifact", async () => {
    const payload = JSON.stringify({ rows: [1, 2, 3] });
    const checksumSha256 = createHash("sha256").update(payload).digest("hex");
    const artifact = { id: jobId, schema: "worker-result-v1" as const, contentType: "application/json" as const, checksumSha256, byteLength: Buffer.byteLength(payload) };
    findOne.mockResolvedValue({
      _id: jobId, owner: "api-key:reader", status: "complete", attempts: 1, artifact,
      createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000)
    });
    findArtifact.mockResolvedValue({ _id: jobId, owner: "api-key:reader", payload, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), ...artifact });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}/result`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { rows: [1, 2, 3] } });
  });

  it("fails closed when stored artifact integrity does not match", async () => {
    const payload = JSON.stringify({ ok: true });
    const artifact = { id: jobId, schema: "worker-result-v1" as const, contentType: "application/json" as const, checksumSha256: "0".repeat(64), byteLength: Buffer.byteLength(payload) };
    findOne.mockResolvedValue({
      _id: jobId, owner: "api-key:reader", status: "complete", attempts: 1, artifact,
      createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000)
    });
    findArtifact.mockResolvedValue({ _id: jobId, owner: "api-key:reader", payload, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), ...artifact });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}/result`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Worker result unavailable" });
  });
});
