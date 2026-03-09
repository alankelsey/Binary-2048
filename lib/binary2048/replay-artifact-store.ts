import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type ReplayArtifactRef =
  | {
      kind: "inline";
    }
  | {
      kind: "s3";
      bucket: string;
      key: string;
      checksumSha256: string;
      encoding: "gzip";
      contentType: "application/json";
    };

type ReplayArtifactStore = {
  persistIfConfigured: (
    runId: string,
    replay: CompactReplayPayload,
    context: { score: number; contestId?: string }
  ) => Promise<ReplayArtifactRef>;
  load: (ref: ReplayArtifactRef) => Promise<CompactReplayPayload | null>;
};

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export function shouldArchiveReplayToS3(context: { score: number; contestId?: string }) {
  const minScore = parsePositiveInt(process.env.BINARY2048_REPLAY_S3_MIN_SCORE, 2048);
  const contestOnly = (process.env.BINARY2048_REPLAY_S3_CONTEST_ONLY ?? "false").toLowerCase() === "true";
  if (context.contestId) return true;
  if (contestOnly) return false;
  return context.score >= minScore;
}

class InlineReplayArtifactStore implements ReplayArtifactStore {
  async persistIfConfigured() {
    return { kind: "inline" as const };
  }

  async load() {
    return null;
  }
}

class S3ReplayArtifactStore implements ReplayArtifactStore {
  private readonly bucket: string;
  private readonly region: string;
  private readonly prefix: string;
  private clientPromise: Promise<S3Client> | null = null;

  constructor(bucket: string, region: string, prefix: string) {
    this.bucket = bucket;
    this.region = region;
    this.prefix = prefix;
  }

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = Promise.resolve(new S3Client({ region: this.region }));
    }
    return this.clientPromise;
  }

  private objectKey(runId: string) {
    const date = new Date().toISOString().slice(0, 10);
    return `${this.prefix}/${date}/${runId}.json.gz`;
  }

  async persistIfConfigured(
    runId: string,
    replay: CompactReplayPayload,
    context: { score: number; contestId?: string }
  ): Promise<ReplayArtifactRef> {
    if (!shouldArchiveReplayToS3(context)) {
      return { kind: "inline" as const };
    }

    const payload = Buffer.from(JSON.stringify(replay));
    const compressed = gzipSync(payload, { level: 9 });
    const checksumSha256 = createHash("sha256").update(compressed).digest("hex");
    const key = this.objectKey(runId);

    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: compressed,
        ContentEncoding: "gzip",
        ContentType: "application/json",
        Metadata: {
          checksumSha256
        }
      })
    );

    return {
      kind: "s3",
      bucket: this.bucket,
      key,
      checksumSha256,
      encoding: "gzip",
      contentType: "application/json"
    };
  }

  async load(ref: ReplayArtifactRef) {
    if (ref.kind !== "s3") return null;
    const client = await this.getClient();
    const output = await client.send(
      new GetObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key
      })
    );
    const bytes = await output.Body?.transformToByteArray?.();
    if (!bytes) return null;
    const compressed = Buffer.from(bytes);
    const checksumSha256 = createHash("sha256").update(compressed).digest("hex");
    if (checksumSha256 !== ref.checksumSha256) {
      throw new Error("Replay artifact checksum mismatch");
    }
    const json = gunzipSync(compressed).toString("utf8");
    return JSON.parse(json) as CompactReplayPayload;
  }
}

const globalStore = globalThis as typeof globalThis & {
  __binary2048_replay_artifact_store?: ReplayArtifactStore;
};

function createReplayArtifactStore(): ReplayArtifactStore {
  const mode = (process.env.BINARY2048_REPLAY_ARTIFACT_STORE ?? "inline").toLowerCase();
  if (mode !== "s3") {
    return new InlineReplayArtifactStore();
  }
  const bucket = process.env.BINARY2048_REPLAY_S3_BUCKET ?? "";
  if (!bucket) {
    throw new Error("BINARY2048_REPLAY_S3_BUCKET is required when BINARY2048_REPLAY_ARTIFACT_STORE=s3");
  }
  const region = process.env.BINARY2048_REPLAY_S3_REGION ?? process.env.AWS_REGION ?? "us-east-2";
  const prefix = process.env.BINARY2048_REPLAY_S3_PREFIX ?? "replays";
  return new S3ReplayArtifactStore(bucket, region, prefix);
}

export function getReplayArtifactStore() {
  if (!globalStore.__binary2048_replay_artifact_store) {
    globalStore.__binary2048_replay_artifact_store = createReplayArtifactStore();
  }
  return globalStore.__binary2048_replay_artifact_store;
}

export function resetReplayArtifactStoreForTests() {
  delete globalStore.__binary2048_replay_artifact_store;
}
