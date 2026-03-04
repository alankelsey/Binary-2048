import { NextResponse } from "next/server";
import { listMarketingEvents } from "@/lib/binary2048/marketing";

function parseLimit(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(500, Math.floor(parsed));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  return NextResponse.json({
    limit,
    events: listMarketingEvents(limit)
  });
}
