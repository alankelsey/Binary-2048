import { execFileSync } from "node:child_process";
import { MongoClient } from "mongodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomBytes } from "node:crypto";
const region = "us-east-2";
const aws = args => JSON.parse(execFileSync("aws", [...args, "--region", region, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const app = aws(["amplify", "get-app", "--app-id", "dzxvs1esr22z9"]).app;
const branch = aws(["amplify", "get-branch", "--app-id", "dzxvs1esr22z9", "--branch-name", "main"]).branch;
const env = { ...app.environmentVariables, ...branch.environmentVariables };
const outputs = Object.fromEntries(aws(["cloudformation", "describe-stacks", "--stack-name", "binary2048-v1-workers"]).Stacks[0].Outputs.map(item => [item.OutputKey, item.OutputValue]));
const client = new MongoClient(env.BINARY2048_MONGO_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 2 });
const ids = [];
try {
  await client.connect();
  const jobs = client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_jobs");
  const sqs = new SQSClient({ region });
  for (const [kind, args, queue] of [
    ["tournament", [{ seeds: [100], maxMoves: 3, bots: ["priority"] }], outputs.TournamentQueueUrl],
    ["training-replays", [1, 1, "priority", 0, "v1-acceptance"], outputs.TrainingQueueUrl],
    ["training-labels", [1, 1, "score_delta", 0], outputs.TrainingQueueUrl]
  ]) {
    const id = randomBytes(32).toString("hex"); ids.push(id);
    await jobs.insertOne({ _id: id, task: { kind, args }, status: "queued", attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) });
    await sqs.send(new SendMessageCommand({ QueueUrl: queue, MessageBody: JSON.stringify({ jobId: id }) }));
  }
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const found = await jobs.find({ _id: { $in: ids } }).toArray();
    if (found.some(job => job.status === "failed")) throw new Error("Worker acceptance job failed");
    if (found.length === 3 && found.every(job => job.status === "complete")) {
      if (found.some(job => !job.result)) throw new Error("Worker result missing");
      console.log(JSON.stringify({ tournament: "passed", trainingReplays: "passed", trainingLabels: "passed", attempts: found.map(job => job.attempts) }));
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const complete = await jobs.countDocuments({ _id: { $in: ids }, status: "complete" });
  if (complete !== 3) throw new Error("Worker acceptance timed out");
} catch { console.error("Worker acceptance failed; credentials and provider details suppressed."); process.exitCode = 1; }
finally {
  await client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_jobs").deleteMany({ _id: { $in: ids } }).catch(() => undefined);
  await client.close();
}
