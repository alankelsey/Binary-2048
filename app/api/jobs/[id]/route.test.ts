import { GET } from "@/app/api/jobs/[id]/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { createHash } from "crypto";

const findOne = jest.fn();
const findArtifact = jest.fn();
jest.mock("@/lib/binary2048/worker-jobs", () => ({
  ...jest.requireActual("@/lib/binary2048/worker-jobs"),
  workerJobsEnabled: () => true,
  workerCollections: async () => ({ jobs: { findOne }, artifacts: { findOne: findArtifact } })
}));

const jobId = "a".repeat(64);
const context = { params: Promise.resolve({ id: jobId }) };

describe("GET /api/jobs/{id}", () => {
  afterAll(() => {
    delete process.env.BINARY2048_ADMIN_TOKEN;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_BOT_API_KEY_SCOPES;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStore();
    process.env.BINARY2048_ADMIN_TOKEN = "job-admin";
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_BOT_API_KEY_SCOPES;
  });

  it("requires research authorization", async () => {
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}`), context);
    expect(response.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("hides a job owned by another principal", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      owner: "api-key:other",
      status: "queued",
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}`, {
      headers: { "x-admin-token": "job-admin" }
    }), context);
    expect(response.status).toBe(200);

    delete process.env.BINARY2048_ADMIN_TOKEN;
    process.env.BINARY2048_BOT_API_KEY_HASHES = `reader=${createHash("sha256").update("reader-key").digest("hex")}`;
    process.env.BINARY2048_BOT_API_KEY_SCOPES = "reader=jobs:read";
    const hidden = await GET(new Request(`http://localhost/api/jobs/${jobId}`, {
      headers: { "x-api-key": "reader-key" }
    }), context);
    expect(hidden.status).toBe(404);
  });

  it("allows ownerless pre-deployment jobs until their existing TTL", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      status: "complete",
      attempts: 1,
      result: { ok: true },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}`, {
      headers: { "x-admin-token": "job-admin" }
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ jobId, status: "complete", result: { ok: true } });
  });

  it("keeps contract-v2 status lightweight and points to the result API", async () => {
    findOne.mockResolvedValue({
      _id: jobId,
      owner: "admin:service",
      status: "complete",
      attempts: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}`, {
      headers: { "x-admin-token": "job-admin", "x-binary2048-job-contract": "2" }
    }), context);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ jobId, status: "complete", resultUrl: `/api/jobs/${jobId}/result` });
    expect(json).not.toHaveProperty("result");
    expect(findOne.mock.calls[0][1]).toEqual({ projection: { task: 0, result: 0 } });
    expect(findArtifact).not.toHaveBeenCalled();
  });

  it("loads a persisted artifact only for unversioned result compatibility", async () => {
    const payload = JSON.stringify({ ok: "stored" });
    const checksumSha256 = createHash("sha256").update(payload).digest("hex");
    const artifact = { id: jobId, schema: "worker-result-v1" as const, contentType: "application/json" as const, checksumSha256, byteLength: Buffer.byteLength(payload) };
    findOne.mockResolvedValue({
      _id: jobId, owner: "admin:service", status: "complete", attempts: 1, artifact,
      createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000)
    });
    findArtifact.mockResolvedValue({ _id: jobId, owner: "admin:service", payload, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), ...artifact });
    const response = await GET(new Request(`http://localhost/api/jobs/${jobId}`, {
      headers: { "x-admin-token": "job-admin" }
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { ok: "stored" } });
    expect(findArtifact).toHaveBeenCalledTimes(1);
  });
});
