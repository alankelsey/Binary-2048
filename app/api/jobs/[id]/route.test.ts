import { GET } from "@/app/api/jobs/[id]/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { createHash } from "crypto";

const findOne = jest.fn();
jest.mock("@/lib/binary2048/worker-jobs", () => ({
  workerJobsEnabled: () => true,
  workerCollections: async () => ({ jobs: { findOne } })
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
});
