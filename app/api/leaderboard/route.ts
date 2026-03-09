import { NextResponse } from "next/server";
import { listLeaderboardEntries } from "@/lib/binary2048/leaderboard";

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const namespaceParam = url.searchParams.get("namespace");
  const namespace = namespaceParam === "sandbox" ? "sandbox" : namespaceParam === "production" ? "production" : undefined;
  const includeSandbox = url.searchParams.get("sandbox") === "1";
  const includePractice = url.searchParams.get("practice") === "1";
  const seasonParam = url.searchParams.get("seasonMode");
  const seasonMode = seasonParam === "preview" ? "preview" : seasonParam === "live" ? "live" : undefined;
  return NextResponse.json({
    limit,
    namespace: namespace ?? "production",
    entries: listLeaderboardEntries(limit, {
      namespace,
      includeSandbox,
      includePractice,
      seasonMode
    })
  });
}
