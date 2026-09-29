import { NextResponse } from "next/server";
import { getLeaderboardPage } from "@/lib/binary2048/leaderboard";

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

function parsePage(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const page = parsePage(url.searchParams.get("page"));
  const namespaceParam = url.searchParams.get("namespace");
  const namespace = namespaceParam === "sandbox" ? "sandbox" : namespaceParam === "production" ? "production" : undefined;
  const includeSandbox = url.searchParams.get("sandbox") === "1";
  const includePractice = url.searchParams.get("practice") === "1";
  const seasonParam = url.searchParams.get("seasonMode");
  const seasonMode = seasonParam === "preview" ? "preview" : seasonParam === "live" ? "live" : undefined;
  try {
    const result = await getLeaderboardPage(limit, page, {
      namespace,
      includeSandbox,
      includePractice,
      seasonMode
    });
    return NextResponse.json({
      namespace: namespace ?? "production",
      ...result
    });
  } catch {
    return NextResponse.json({ error: "Leaderboard is temporarily unavailable" }, { status: 503 });
  }
}
