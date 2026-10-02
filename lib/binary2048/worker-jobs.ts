import { randomBytes } from "crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { sharedMongoDb } from "@/lib/binary2048/shared-mongo";
import type { runBotTournament } from "@/lib/binary2048/bot-orchestrator";
import type { generateTrainingLabels, generateTrainingReplays } from "@/lib/binary2048/training-data";

export type WorkerTask =
  | { kind: "tournament"; args: Parameters<typeof runBotTournament> }
  | { kind: "training-replays"; args: Parameters<typeof generateTrainingReplays> }
  | { kind: "training-labels"; args: Parameters<typeof generateTrainingLabels> };
export type WorkerJob = {
  _id: string; task: WorkerTask; status: "queued" | "running" | "complete" | "failed";
  attempts: number; createdAt: Date; expiresAt: Date; leaseUntil?: Date; result?: unknown; error?: string;
};
export const workerJobsEnabled = () => process.env.BINARY2048_WORKER_MODE === "sqs";
export class WorkerBudgetError extends Error { constructor() { super("Monthly research compute allowance reached"); } }
let ready: Promise<void> | undefined;
export async function workerCollections() {
  const db = await sharedMongoDb();
  const jobs = db.collection<WorkerJob>("worker_jobs");
  const budgets = db.collection<{ _id: string; admitted: number; expiresAt: Date }>("worker_budgets");
  if (!ready) ready = Promise.all([
    jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    budgets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]).then(() => undefined).catch(() => { ready = undefined; throw new Error("Worker storage unavailable"); });
  await ready;
  return { jobs, budgets };
}

export async function enqueueWorkerTask(task: WorkerTask) {
  if (Buffer.byteLength(JSON.stringify(task)) > 128 * 1024) throw new Error("Worker payload too large");
  const queueUrl = task.kind === "tournament" ? process.env.BINARY2048_TOURNAMENT_QUEUE_URL : process.env.BINARY2048_TRAINING_QUEUE_URL;
  if (!queueUrl) throw new Error("Worker queue is not configured");
  const { jobs, budgets } = await workerCollections();
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  // A fixed combined allowance: 250 jobs, each at most two 60s/2GB attempts.
  // Reserve before enqueue; failures are conservatively charged to the allowance.
  try { await budgets.updateOne({ _id: month }, { $setOnInsert: { admitted: 0, expiresAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)) } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const reserved = await budgets.updateOne({ _id: month, admitted: { $lt: 250 } }, { $inc: { admitted: 1 } });
  if (!reserved.modifiedCount) throw new WorkerBudgetError();
  const id = randomBytes(32).toString("hex");
  await jobs.insertOne({ _id: id, task, status: "queued", attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + 86400000) });
  try {
    const sqs = new SQSClient({ region: process.env.BINARY2048_WORKER_REGION ?? "us-east-2" });
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify({ jobId: id }) }));
  } catch {
    await jobs.updateOne({ _id: id }, { $set: { status: "failed", error: "Queue delivery failed" } });
    throw new Error("Worker queue unavailable");
  }
  return { jobId: id, status: "queued", statusUrl: `/api/jobs/${id}`, retryAfterSeconds: 2 };
}
