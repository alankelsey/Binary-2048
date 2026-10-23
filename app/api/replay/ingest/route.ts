import { NextResponse } from "next/server";
import { getRunStore, type CanonicalRunRecord } from "@/lib/binary2048/run-store";
import { checkReplayIngestRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";
import { authorizeResearchRequest } from "@/lib/binary2048/research-auth";

type IngestRequestBody = {
  records?: CanonicalRunRecord[];
};

type IngestResponse = {
  ingested: number;
  duplicateIds: string[];
};

const MAX_INGEST_BODY_BYTES = 1024 * 1024;
const MAX_INGEST_RECORDS = 100;

function isRecordLike(value: unknown): value is CanonicalRunRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CanonicalRunRecord>;
  return typeof candidate.id === "string" && typeof candidate.gameId === "string" && typeof candidate.playerId === "string";
}

export async function POST(req: Request) {
  const authorization = authorizeResearchRequest(req, "replay:ingest");
  if (!authorization.allowed) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const quota = await checkReplayIngestRateLimit(req);
  if (!quota.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rateLimitHeaders(quota) });
  let body: IngestRequestBody;
  try {
    body = await parseJsonWithLimit<IngestRequestBody>(req, MAX_INGEST_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413, headers: rateLimitHeaders(quota) });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: rateLimitHeaders(quota) });
  }
  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json({ error: "records[] is required" }, { status: 400, headers: rateLimitHeaders(quota) });
  }
  if (body.records.length > MAX_INGEST_RECORDS) {
    return NextResponse.json(
      { error: `records exceeds max allowed (${MAX_INGEST_RECORDS})`, code: "cost_cap_exceeded", field: "records", limit: MAX_INGEST_RECORDS, value: body.records.length },
      { status: 400, headers: rateLimitHeaders(quota) }
    );
  }
  const records = body.records.filter(isRecordLike);
  if (records.length !== body.records.length) {
    return NextResponse.json({ error: "Every records[] item must be a canonical run record" }, { status: 400, headers: rateLimitHeaders(quota) });
  }

  const deduped = new Map<string, CanonicalRunRecord>();
  for (const record of records) {
    deduped.set(record.id, record);
  }
  const duplicateIds = records
    .map((record) => record.id)
    .filter((id, index, all) => all.indexOf(id) !== index);

  const store = getRunStore();
  for (const record of deduped.values()) {
    await store.upsertRun(record);
  }

  const response: IngestResponse = {
    ingested: deduped.size,
    duplicateIds: Array.from(new Set(duplicateIds))
  };
  return NextResponse.json(response, { status: 200, headers: rateLimitHeaders(quota) });
}
