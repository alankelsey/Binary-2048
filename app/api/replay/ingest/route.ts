import { NextResponse } from "next/server";
import { getRunStore, type CanonicalRunRecord } from "@/lib/binary2048/run-store";

type IngestRequestBody = {
  records?: CanonicalRunRecord[];
};

type IngestResponse = {
  ingested: number;
  duplicateIds: string[];
};

function isRecordLike(value: unknown): value is CanonicalRunRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CanonicalRunRecord>;
  return typeof candidate.id === "string" && typeof candidate.gameId === "string" && typeof candidate.playerId === "string";
}

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => ({}))) as IngestRequestBody);
  const records = Array.isArray(body.records) ? body.records.filter(isRecordLike) : [];
  if (records.length === 0) {
    return NextResponse.json({ error: "records[] is required" }, { status: 400 });
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
  return NextResponse.json(response, { status: 200 });
}

