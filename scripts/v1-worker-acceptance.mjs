import { execFileSync } from "node:child_process";
import { MongoClient } from "mongodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createHash, randomBytes } from "node:crypto";
const region = "us-east-2";
const aws = args => JSON.parse(execFileSync("aws", [...args, "--region", region, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const app = aws(["amplify", "get-app", "--app-id", "dzxvs1esr22z9"]).app;
const branch = aws(["amplify", "get-branch", "--app-id", "dzxvs1esr22z9", "--branch-name", "main"]).branch;
const env = { ...app.environmentVariables, ...branch.environmentVariables };
const outputs = Object.fromEntries(aws(["cloudformation", "describe-stacks", "--stack-name", "binary2048-v1-workers"]).Stacks[0].Outputs.map(item => [item.OutputKey, item.OutputValue]));
const expectedAlarms = [
  "binary2048-v1-compute-errors", "binary2048-v1-compute-throttles", "binary2048-v1-compute-duration",
  "binary2048-v1-compute-concurrency", "binary2048-v1-compute-queue-age", "binary2048-v1-compute-dlq",
  "binary2048-v1-training-errors", "binary2048-v1-training-throttles", "binary2048-v1-training-duration",
  "binary2048-v1-training-concurrency", "binary2048-v1-training-queue-age", "binary2048-v1-training-dlq"
];
for (const name of ["binary2048-v1-tournament", "binary2048-v1-training"]) {
  const config = aws(["lambda", "get-function-configuration", "--function-name", name]);
  const mapping = aws(["lambda", "list-event-source-mappings", "--function-name", name]).EventSourceMappings[0];
  if (config.MemorySize !== 2048 || config.Timeout !== 60 || mapping?.BatchSize !== 1 || mapping?.ScalingConfig?.MaximumConcurrency !== 2) {
    throw new Error("Worker isolation controls do not match the accepted boundary");
  }
}
const alarms = aws(["cloudwatch", "describe-alarms", "--alarm-name-prefix", "binary2048-v1-"]).MetricAlarms;
if (!expectedAlarms.every(name => alarms.some(alarm => alarm.AlarmName === name && alarm.AlarmActions?.length === 1))) {
  throw new Error("Worker alarm coverage is incomplete");
}
const client = new MongoClient(env.BINARY2048_MONGO_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 2 });
const ids = [];
try {
  await client.connect();
  const jobs = client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_jobs");
  const artifacts = client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_artifacts");
  const sqs = new SQSClient({ region });
  for (const [kind, args, queue] of [
    ["simulation", [{ seed: 7, moves: ["L"] }], outputs.TournamentQueueUrl],
    ["tournament", [{ seeds: [100], maxMoves: 3, bots: ["priority"] }], outputs.TournamentQueueUrl],
    ["training-replays", [1, 1, "priority", 0, "v1-acceptance"], outputs.TrainingQueueUrl],
    ["training-labels", [1, 1, "score_delta", 0], outputs.TrainingQueueUrl]
  ]) {
    const id = randomBytes(32).toString("hex"); ids.push(id);
    await jobs.insertOne({ _id: id, owner: "admin:worker-acceptance", task: { kind, args }, status: "queued", attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) });
    await sqs.send(new SendMessageCommand({ QueueUrl: queue, MessageBody: JSON.stringify({ jobId: id }) }));
  }
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const found = await jobs.find({ _id: { $in: ids } }).toArray();
    if (found.some(job => job.status === "failed")) throw new Error("Worker acceptance job failed");
    if (found.length === 4 && found.every(job => job.status === "complete")) {
      if (found.some(job => Object.hasOwn(job, "result") || job.artifact?.schema !== "worker-result-v1")) throw new Error("Worker artifact metadata missing");
      const stored = await artifacts.find({ _id: { $in: ids } }).toArray();
      if (stored.length !== 4 || stored.some(artifact => artifact.owner !== "admin:worker-acceptance" ||
        artifact.byteLength !== Buffer.byteLength(artifact.payload) ||
        artifact.checksumSha256 !== createHash("sha256").update(artifact.payload).digest("hex"))) {
        throw new Error("Worker artifact integrity verification failed");
      }
      console.log(JSON.stringify({ controls: "passed", alarms: expectedAlarms.length, artifacts: "passed", simulation: "passed", tournament: "passed", trainingReplays: "passed", trainingLabels: "passed", attempts: found.map(job => job.attempts) }));
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const complete = await jobs.countDocuments({ _id: { $in: ids }, status: "complete" });
  if (complete !== 4) throw new Error("Worker acceptance timed out");
} catch { console.error("Worker acceptance failed; credentials and provider details suppressed."); process.exitCode = 1; }
finally {
  await client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_jobs").deleteMany({ _id: { $in: ids } }).catch(() => undefined);
  await client.db(env.BINARY2048_MONGO_DB ?? "binary2048").collection("worker_artifacts").deleteMany({ _id: { $in: ids } }).catch(() => undefined);
  await client.close();
}
