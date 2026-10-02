import { enqueueWorkerTask, WorkerBudgetError } from "./worker-jobs";
import { handler } from "../../workers/index";

const send = jest.fn();
const budgetUpdate = jest.fn();
const jobInsert = jest.fn();
const jobUpdate = jest.fn();
const claim = jest.fn();
const jobRead = jest.fn();
jest.mock("@aws-sdk/client-sqs", () => ({ SQSClient: jest.fn().mockImplementation(() => ({ send })), SendMessageCommand: jest.fn().mockImplementation(input => input) }));
jest.mock("./shared-mongo", () => ({ sharedMongoDb: jest.fn(async () => ({ collection: (name: string) => name === "worker_budgets" ? { createIndex: jest.fn(), updateOne: budgetUpdate } : { createIndex: jest.fn(), insertOne: jobInsert, updateOne: jobUpdate, findOneAndUpdate: claim, findOne: jobRead } })) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BINARY2048_TOURNAMENT_QUEUE_URL = "https://sqs.us-east-2.amazonaws.com/test/tournament";
  budgetUpdate.mockResolvedValue({ modifiedCount: 1 });
  send.mockResolvedValue({});
  jobInsert.mockResolvedValue({});
  jobUpdate.mockResolvedValue({ modifiedCount: 1 });
});
afterAll(() => { delete process.env.BINARY2048_TOURNAMENT_QUEUE_URL; });

it("reserves the shared allowance before dispatch and queues only an opaque id", async () => {
  const result = await enqueueWorkerTask({ kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] });
  expect(result.jobId).toMatch(/^[a-f0-9]{64}$/);
  expect(budgetUpdate.mock.calls[1][0]).toMatchObject({ admitted: { $lt: 250 } });
  expect(JSON.parse(send.mock.calls[0][0].MessageBody)).toEqual({ jobId: result.jobId });
  expect(jobInsert.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
});

it("refuses dispatch when the monthly allowance is exhausted", async () => {
  budgetUpdate.mockResolvedValue({ modifiedCount: 0 });
  await expect(enqueueWorkerTask({ kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] })).rejects.toBeInstanceOf(WorkerBudgetError);
  expect(send).not.toHaveBeenCalled();
  expect(jobInsert).not.toHaveBeenCalled();
});

it("does not execute an already completed duplicate delivery", async () => {
  claim.mockResolvedValue(null); jobRead.mockResolvedValue({ status: "complete" });
  expect(await handler({ Records: [{ messageId: "one", body: JSON.stringify({ jobId: "a".repeat(64) }) }] })).toEqual({ batchItemFailures: [] });
  expect(jobUpdate).not.toHaveBeenCalled();
});

it("computes a claimed deterministic job and conditionally commits its result", async () => {
  claim.mockResolvedValue({ status: "running", attempts: 1, task: { kind: "tournament", args: [{ seeds: [1], maxMoves: 1, bots: ["priority"] }] } });
  expect(await handler({ Records: [{ messageId: "one", body: JSON.stringify({ jobId: "b".repeat(64) }) }] })).toEqual({ batchItemFailures: [] });
  expect(jobUpdate.mock.calls[0][0]).toEqual({ _id: "b".repeat(64), attempts: 1, status: "running" });
  expect(jobUpdate.mock.calls[0][1].$set.status).toBe("complete");
});
