import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { getLeaderboardPage } from "@/lib/binary2048/leaderboard";

function positiveInt(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number(value);
  const resolved = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  return maximum ? Math.min(maximum, resolved) : resolved;
}

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const url = new URL(req.url);
  const namespace = url.searchParams.get("namespace") === "sandbox" ? "sandbox" : "production";
  const seasonMode = url.searchParams.get("seasonMode") === "preview" ? "preview" : "live";
  const includePractice = url.searchParams.get("practice") === "1";
  const limit = positiveInt(url.searchParams.get("limit"), 20, 100);
  const page = positiveInt(url.searchParams.get("page"), 1);

  try {
    const result = await getLeaderboardPage(limit, page, { namespace, seasonMode, includePractice });
    const mode = (process.env.BINARY2048_LEADERBOARD_STORE ?? "memory").toLowerCase();
    return NextResponse.json(
      {
        source: { backend: mode, scope: mode === "mongo" ? "shared" : "runtime", readOnly: true },
        filters: { namespace, seasonMode, includePractice },
        ...result
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Leaderboard operations data is temporarily unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}
