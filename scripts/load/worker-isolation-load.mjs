#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  boundedInteger,
  buildWorkerTaskSpecs,
  evaluateReport,
  isLoopbackTarget,
  percentile,
  summarizeBrowser
} from "./worker-isolation-load-lib.mjs";

const execFileAsync = promisify(execFile);
const region = process.env.AWS_REGION || "us-east-2";
const baseURL = process.env.BASE_URL || "http://localhost:3000";
const validateOnly = process.env.WORKER_ISOLATION_VALIDATE_ONLY === "1";
const output = process.env.WORKER_ISOLATION_OUTPUT;
const httpClients = boundedInteger(process.env.GAMEPLAY_CLIENTS, 4, { name: "GAMEPLAY_CLIENTS", min: 1, max: 4 });
const movesPerClient = boundedInteger(process.env.GAMEPLAY_MOVES_PER_CLIENT, 10, { name: "GAMEPLAY_MOVES_PER_CLIENT", min: 5, max: 25 });
const jobsPerClass = boundedInteger(process.env.WORKER_JOBS_PER_CLASS, 2, { name: "WORKER_JOBS_PER_CLASS", min: 1, max: 2 });
const production = !isLoopbackTarget(baseURL);

if (production && process.env.ALLOW_PRODUCTION_LOAD !== "1") {
  throw new Error("External load testing requires ALLOW_PRODUCTION_LOAD=1");
}
if (production && new URL(baseURL).host !== "www.binary2048.com") {
  throw new Error("The deployed worker-isolation protocol is pinned to www.binary2048.com");
}

const config = {
  baseURL,
  production,
  httpClients,
  movesPerClient,
  jobsPerClass,
  maximumGameplayMovesPerStage: httpClients * movesPerClient + 42,
  workerPayloads: {
    tournament: "25 seeds x 2 bots x 500 moves = 25,000 decisions (public hard cap)",
    training: "500 rollout labels (public hard cap)"
  }
};

if (validateOnly) {
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, validated: true, config }, null, 2)}\n`);
  process.exit(0);
}

function aws(args) {
  return JSON.parse(execFileSync("aws", [...args, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }));
}

async function runBrowserStage() {
  const { stdout } = await execFileAsync(process.execPath, ["scripts/v2-phase0-browser-measurement.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      V2_BROWSER_BASE: baseURL,
      V2_BROWSER_MODE: "guest",
      V2_BROWSER_HEADLESS: "1",
      V2_BROWSER_OUTPUT: ""
    },
    maxBuffer: 20 * 1024 * 1024
  });
  return summarizeBrowser(JSON.parse(stdout));
}

async function post(pathname, body) {
  const started = performance.now();
  const response = await fetch(new URL(pathname, baseURL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const elapsedMs = Number((performance.now() - started).toFixed(2));
  let payload = null;
  try { payload = await response.json(); } catch { /* status is sufficient */ }
  return { status: response.status, elapsedMs, payload };
}

async function runHttpClient(index) {
  const create = await post("/api/games", { seed: 41000 + index });
  if (create.status !== 200 || !create.payload?.id) return { timings: [], errors: 1 };
  const keys = ["left", "down", "right", "up"];
  const timings = [];
  let errors = 0;
  for (let move = 0; move < movesPerClient; move += 1) {
    const response = await post(`/api/games/${create.payload.id}/move`, { dir: keys[(move + index) % keys.length] });
    if (response.status !== 200) errors += 1;
    else timings.push(response.elapsedMs);
  }
  return { timings, errors };
}

async function runHttpStage() {
  const results = await Promise.all(Array.from({ length: httpClients }, (_, index) => runHttpClient(index)));
  const timings = results.flatMap((result) => result.timings);
  return {
    requests: httpClients * movesPerClient,
    successfulMoves: timings.length,
    errors: results.reduce((sum, result) => sum + result.errors, 0),
    moveP50Ms: percentile(timings, 50),
    moveP95Ms: percentile(timings, 95)
  };
}

async function runGameplayStage() {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const [browser, http] = await Promise.all([runBrowserStage(), runHttpStage()]);
  return { startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - startedMs, browser, http };
}

async function waitForOverlap(jobs, ids, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await jobs.find({ _id: { $in: ids } }, { projection: { status: 1, "task.kind": 1 } }).toArray();
    const tournament = current.some((job) => job.status === "running" && job.task?.kind === "tournament");
    const training = current.some((job) => job.status === "running" && job.task?.kind === "training-labels");
    if (tournament && training) return { tournament, training, observedAt: new Date().toISOString() };
    if (current.some((job) => job.status === "failed")) throw new Error("A controlled worker job failed before overlap was observed");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Both worker classes were not observed running within 30 seconds");
}

async function waitForJobs(jobs, ids, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await jobs.find({ _id: { $in: ids } }, { projection: { status: 1, attempts: 1 } }).toArray();
    if (current.some((job) => job.status === "failed")) throw new Error("A controlled worker job failed");
    if (current.length === ids.length && current.every((job) => job.status === "complete")) {
      return current.map((job) => ({ status: job.status, attempts: job.attempts }));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Controlled worker jobs did not complete within 150 seconds");
}

async function writeReport(report) {
  if (!output) return;
  const outputPath = path.resolve(output);
  const allowedRoot = path.resolve("docs/load-results");
  if (!outputPath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error("WORKER_ISOLATION_OUTPUT must be inside docs/load-results");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

let client;
let jobs;
let artifacts;
const ids = [];
try {
  process.stderr.write("Capturing paired baseline gameplay stage...\n");
  const baseline = await runGameplayStage();

  if (!production) {
    throw new Error("Worker orchestration requires the deployed worker environment; local mode supports validation only");
  }
  const app = aws(["amplify", "get-app", "--app-id", "dzxvs1esr22z9"]).app;
  const branch = aws(["amplify", "get-branch", "--app-id", "dzxvs1esr22z9", "--branch-name", "main"]).branch;
  const env = { ...app.environmentVariables, ...branch.environmentVariables };
  const outputs = Object.fromEntries(
    aws(["cloudformation", "describe-stacks", "--stack-name", "binary2048-v1-workers"]).Stacks[0].Outputs
      .map((item) => [item.OutputKey, item.OutputValue])
  );
  client = new MongoClient(env.BINARY2048_MONGO_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 2 });
  await client.connect();
  const database = client.db(env.BINARY2048_MONGO_DB ?? "binary2048");
  jobs = database.collection("worker_jobs");
  artifacts = database.collection("worker_artifacts");
  const sqs = new SQSClient({ region });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  for (const record of buildWorkerTaskSpecs({
    jobsPerClass,
    tournamentQueueUrl: outputs.TournamentQueueUrl,
    trainingQueueUrl: outputs.TrainingQueueUrl
  })) {
    const id = randomBytes(32).toString("hex");
    ids.push(id);
    await jobs.insertOne({
      _id: id,
      owner: "admin:worker-isolation-load",
      task: record.task,
      status: "queued",
      attempts: 0,
      createdAt: new Date(),
      expiresAt
    });
    await sqs.send(new SendMessageCommand({ QueueUrl: record.queueUrl, MessageBody: JSON.stringify({ jobId: id }) }));
  }

  const workerOverlap = await waitForOverlap(jobs, ids);
  process.stderr.write("Both worker classes are running; capturing loaded gameplay stage...\n");
  const loaded = await runGameplayStage();
  const completedJobs = await waitForJobs(jobs, ids);
  const evaluation = evaluateReport({ baseline, loaded, workerOverlap, jobs: completedJobs });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetHost: new URL(baseURL).host,
    config,
    workerOverlap,
    baseline,
    loaded,
    jobs: {
      count: completedJobs.length,
      completed: completedJobs.filter((job) => job.status === "complete").length,
      attempts: completedJobs.map((job) => job.attempts)
    },
    ...evaluation
  };
  await writeReport(report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Worker-isolation load test failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (jobs && ids.length) await jobs.deleteMany({ _id: { $in: ids } }).catch(() => undefined);
  if (artifacts && ids.length) await artifacts.deleteMany({ _id: { $in: ids } }).catch(() => undefined);
  await client?.close().catch(() => undefined);
}
