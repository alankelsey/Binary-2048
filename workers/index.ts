import { runBotTournament } from "@/lib/binary2048/bot-orchestrator";
import { generateTrainingReplays, generateTrainingLabels } from "@/lib/binary2048/training-data";
import { workerCollections, type WorkerTask } from "@/lib/binary2048/worker-jobs";

export function executeWorkerTask(task: WorkerTask) {
  switch (task.kind) {
    case "tournament": return runBotTournament(...task.args);
    case "training-replays": return generateTrainingReplays(...task.args);
    case "training-labels": return generateTrainingLabels(...task.args);
  }
}

export async function handler(event: { Records: Array<{ messageId: string; body: string }> }) {
  const failures: Array<{ itemIdentifier: string }> = [];
  const { jobs } = await workerCollections();
  for (const record of event.Records) {
    let jobId: string | undefined;
    try {
      jobId = (JSON.parse(record.body) as { jobId?: string }).jobId;
      if (!jobId || !/^[a-f0-9]{64}$/.test(jobId)) continue;
      const now = new Date();
      const job = await jobs.findOneAndUpdate({
        _id: jobId, expiresAt: { $gt: now }, attempts: { $lt: 2 },
        $or: [{ status: "queued" }, { status: "running", leaseUntil: { $lt: now } }]
      }, { $set: { status: "running", leaseUntil: new Date(now.getTime() + 90000) }, $inc: { attempts: 1 } }, { returnDocument: "after" });
      if (!job) {
        const existing = await jobs.findOne({ _id: jobId });
        if (existing?.status === "running" && existing.leaseUntil && existing.leaseUntil.getTime() > Date.now()) throw new Error("Job lease active");
        if (existing?.status === "running") await jobs.updateOne({ _id: jobId, attempts: 2 }, { $set: { status: "failed", error: "Worker execution limit reached" } });
        continue;
      }
      const result = executeWorkerTask(job.task);
      if (Buffer.byteLength(JSON.stringify(result)) > 12 * 1024 * 1024) throw new Error("Result exceeds storage limit");
      await jobs.updateOne({ _id: jobId, attempts: job.attempts, status: "running" }, { $set: { status: "complete", result }, $unset: { task: "", leaseUntil: "" } });
    } catch {
      // Retry only via SQS, never an unbounded local loop. Timeouts expire the lease.
      failures.push({ itemIdentifier: record.messageId });
      if (jobId) await jobs.updateOne({ _id: jobId, status: "running", attempts: { $gte: 2 } }, { $set: { status: "failed", error: "Worker execution failed" } }).catch(() => undefined);
    }
  }
  return { batchItemFailures: failures };
}
