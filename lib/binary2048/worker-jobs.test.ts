import { createHash } from "crypto";
import { enqueueWorkerTask, loadWorkerArtifact, persistWorkerArtifact, WorkerBudgetError } from "./worker-jobs";
import { handler } from "../../workers/index";

const send = jest.fn();
const budgetUpdate = jest.fn();
const jobInsert = jest.fn();
const jobUpdate = jest.fn();
const claim = jest.fn();
const jobRead = jest.fn();
const artifactRead = jest.fn();
const artifactReplace = jest.fn();
jest.mock("@aws-sdk/client-sqs", () => ({ SQSClient: jest.fn().mockImplementation(() => ({ send })), SendMessageCommand: jest.fn().mockImplementation(input => input) }));
jest.mock("./shared-mongo", () => ({ sharedMongoDb: jest.fn(async () => ({ collection: (name: string) => {
  if (name === "worker_budgets") return { createIndex: jest.fn(), updateOne: budgetUpdate };
  if (name === "worker_artifacts") return { createIndex: jest.fn(), replaceOne: artifactReplace, findOne: artifactRead };
  return { createIndex: jest.fn(), insertOne: jobInsert, updateOne: jobUpdate, findOneAndUpdate: claim, findOne: jobRead };
} })) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BINARY2048_TOURNAMENT_QUEUE_URL = "https://sqs.us-east-2.amazonaws.com/test/tournament";
  process.env.BINARY2048_TRAINING_QUEUE_URL = "https://sqs.us-east-2.amazonaws.com/test/training";
  delete process.env.BINARY2048_WORKER_MONTHLY_COMPUTE_JOBS;
  delete process.env.BINARY2048_WORKER_MONTHLY_TRAINING_JOBS;
  budgetUpdate.mockResolvedValue({ modifiedCount: 1 });
  send.mockResolvedValue({});
  jobInsert.mockResolvedValue({});
  jobUpdate.mockResolvedValue({ modifiedCount: 1 });
  artifactReplace.mockResolvedValue({ modifiedCount: 1 });
});
afterAll(() => {
  delete process.env.BINARY2048_TOURNAMENT_QUEUE_URL;
  delete process.env.BINARY2048_TRAINING_QUEUE_URL;
  delete process.env.BINARY2048_WORKER_MONTHLY_COMPUTE_JOBS;
  delete process.env.BINARY2048_WORKER_MONTHLY_TRAINING_JOBS;
});

it("reserves the shared allowance before dispatch and queues only an opaque id", async () => {
  const result = await enqueueWorkerTask({ kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] }, "api-key:test");
  expect(result.jobId).toMatch(/^[a-f0-9]{64}$/);
  expect(result.resultUrl).toBe(`/api/jobs/${result.jobId}/result`);
  expect(budgetUpdate.mock.calls[1][0]).toMatchObject({ admitted: { $lt: 25 } });
  expect(budgetUpdate.mock.calls[2][0]._id).toMatch(/^class:compute:/);
  expect(budgetUpdate.mock.calls[3][0]).toMatchObject({ admitted: { $lt: 150 } });
  expect(budgetUpdate.mock.calls[5][0]).toMatchObject({ admitted: { $lt: 250 } });
  expect(jobInsert.mock.calls[0][0]).toMatchObject({ owner: "api-key:test" });
  expect(JSON.parse(send.mock.calls[0][0].MessageBody)).toEqual({ jobId: result.jobId });
  expect(jobInsert.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
});

it("refuses dispatch when the monthly allowance is exhausted", async () => {
  budgetUpdate
    .mockResolvedValueOnce({ modifiedCount: 0 })
    .mockResolvedValueOnce({ modifiedCount: 1 })
    .mockResolvedValueOnce({ modifiedCount: 0 })
    .mockResolvedValueOnce({ modifiedCount: 1 })
    .mockResolvedValueOnce({ modifiedCount: 0 })
    .mockResolvedValueOnce({ modifiedCount: 0 });
  await expect(enqueueWorkerTask({ kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] }, "api-key:test")).rejects.toBeInstanceOf(WorkerBudgetError);
  expect(send).not.toHaveBeenCalled();
  expect(jobInsert).not.toHaveBeenCalled();
});

it("enforces a separate configurable training allowance", async () => {
  process.env.BINARY2048_WORKER_MONTHLY_TRAINING_JOBS = "7";
  await enqueueWorkerTask({ kind: "training-replays", args: [1, 1, "priority", 0, "test"] }, "api-key:trainer");
  expect(budgetUpdate.mock.calls[2][0]._id).toMatch(/^class:training:/);
  expect(budgetUpdate.mock.calls[3][0]).toMatchObject({ admitted: { $lt: 7 } });
  expect(send.mock.calls[0][0].QueueUrl).toContain("/training");
});

it("stops before global reservation and dispatch when a class allowance is exhausted", async () => {
  budgetUpdate
    .mockResolvedValueOnce({ modifiedCount: 0 })
    .mockResolvedValueOnce({ modifiedCount: 1 })
    .mockResolvedValueOnce({ modifiedCount: 0 })
    .mockResolvedValueOnce({ modifiedCount: 0 });
  await expect(enqueueWorkerTask({ kind: "simulation", args: [{ seed: 1, moves: ["L"] }] }, "api-key:test"))
    .rejects.toBeInstanceOf(WorkerBudgetError);
  expect(budgetUpdate).toHaveBeenCalledTimes(4);
  expect(send).not.toHaveBeenCalled();
});

it("does not execute an already completed duplicate delivery", async () => {
  claim.mockResolvedValue(null); jobRead.mockResolvedValue({ status: "complete" });
  expect(await handler({ Records: [{ messageId: "one", body: JSON.stringify({ jobId: "a".repeat(64) }) }] })).toEqual({ batchItemFailures: [] });
  expect(jobUpdate).not.toHaveBeenCalled();
});

it("persists a claimed deterministic job artifact before conditionally completing it", async () => {
  claim.mockResolvedValue({ _id: "b".repeat(64), owner: "api-key:test", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), status: "running", attempts: 1, task: { kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] } });
  expect(await handler({ Records: [{ messageId: "one", body: JSON.stringify({ jobId: "b".repeat(64) }) }] })).toEqual({ batchItemFailures: [] });
  expect(artifactReplace).toHaveBeenCalledTimes(1);
  expect(artifactReplace.mock.invocationCallOrder[0]).toBeLessThan(jobUpdate.mock.invocationCallOrder[0]);
  expect(jobUpdate.mock.calls[0][0]).toEqual({ _id: "b".repeat(64), attempts: 1, status: "running" });
  expect(jobUpdate.mock.calls[0][1].$set.status).toBe("complete");
  expect(jobUpdate.mock.calls[0][1].$set.artifact).toMatchObject({ id: "b".repeat(64), schema: "worker-result-v1" });
  expect(jobUpdate.mock.calls[0][1].$set).not.toHaveProperty("result");
});

it("executes a claimed simulation outside the web request", async () => {
  claim.mockResolvedValue({ _id: "c".repeat(64), owner: "api-key:test", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), status: "running", attempts: 1, task: { kind: "simulation", args: [{ seed: 7, moves: ["L"] }] } });
  expect(await handler({ Records: [{ messageId: "sim", body: JSON.stringify({ jobId: "c".repeat(64) }) }] })).toEqual({ batchItemFailures: [] });
  const stored = artifactReplace.mock.calls[0][1];
  expect(JSON.parse(stored.payload)).toMatchObject({ rulesetId: "binary2048-v1", seed: 7 });
  expect(stored.checksumSha256).toBe(createHash("sha256").update(stored.payload).digest("hex"));
});

it("loads a stored artifact only when its identity, owner, size, and digest match", async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const artifactCollection = { replaceOne: artifactReplace, findOne: artifactRead } as never;
  const ref = await persistWorkerArtifact(artifactCollection, {
    _id: "d".repeat(64), owner: "api-key:test", createdAt: new Date(), expiresAt
  }, { ok: true });
  artifactRead.mockResolvedValue(artifactReplace.mock.calls[0][1]);
  await expect(loadWorkerArtifact(artifactCollection, {
    _id: "d".repeat(64), owner: "api-key:test", artifact: ref
  })).resolves.toEqual({ ok: true });

  artifactRead.mockResolvedValue({ ...artifactReplace.mock.calls[0][1], payload: "{}" });
  await expect(loadWorkerArtifact(artifactCollection, {
    _id: "d".repeat(64), owner: "api-key:test", artifact: ref
  })).rejects.toThrow("integrity");

  artifactRead.mockResolvedValue({ ...artifactReplace.mock.calls[0][1], owner: "api-key:other" });
  await expect(loadWorkerArtifact(artifactCollection, {
    _id: "d".repeat(64), owner: "api-key:test", artifact: ref
  })).rejects.toThrow("unavailable");
});

it("rejects an oversized artifact before storage", async () => {
  const artifactCollection = { replaceOne: artifactReplace, findOne: artifactRead } as never;
  await expect(persistWorkerArtifact(artifactCollection, {
    _id: "e".repeat(64), owner: "api-key:test", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000)
  }, { value: "x".repeat(12 * 1024 * 1024) })).rejects.toThrow("storage limit");
  expect(artifactReplace).not.toHaveBeenCalled();
});
