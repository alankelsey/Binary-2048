import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import {
  listLeaderboardEntriesByPlayer,
  removeLeaderboardEntriesByPlayer,
  submitLeaderboardEntry
} from "@/lib/binary2048/leaderboard";
import { createSession, moveSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

type ProbeBody = {
  action?: "write" | "read" | "delete";
  probeId?: string;
};

const PROBE_ID_PATTERN = /^[a-f0-9]{32}$/;

function playerIdFor(probeId: string) {
  return `ops-leaderboard-probe-${probeId}`;
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const body = (await req.json().catch(() => ({}))) as ProbeBody;
  if (!body.action || !body.probeId || !PROBE_ID_PATTERN.test(body.probeId)) {
    return NextResponse.json({ error: "Valid action and probeId are required" }, { status: 400 });
  }

  const playerId = playerIdFor(body.probeId);
  try {
    if (body.action === "write") {
      const initialGrid: Cell[][] = [
        [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ];
      const session = (await createSession(
        { seed: Date.now(), spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } },
        initialGrid,
        { sessionClass: "ranked" }
      ));
      (await moveSession(session.current.id, "left", session));
      await submitLeaderboardEntry({
        playerId,
        userTier: "authed",
        gameId: session.current.id,
        session,
        isPractice: true
      });
      return NextResponse.json({ ok: true, action: "write" });
    }

    if (body.action === "read") {
      const entries = await listLeaderboardEntriesByPlayer(playerId, 10);
      return NextResponse.json({ ok: true, action: "read", found: entries.length > 0, count: entries.length });
    }

    const removed = await removeLeaderboardEntriesByPlayer(playerId);
    return NextResponse.json({ ok: true, action: "delete", removed });
  } catch {
    return NextResponse.json({ ok: false, error: "Leaderboard probe failed" }, { status: 503 });
  }
}
