import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { asyncMatchStandings, createAsyncSameSeedMatch } from "@/lib/binary2048/async-pvp";
import type { GameConfig } from "@/lib/binary2048/types";

type CreateMatchBody = {
  createdBy?: string;
  opponentId?: string;
  seed?: number;
  config?: Partial<GameConfig>;
};

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) as CreateMatchBody);
    const claims = getVerifiedAuthClaims(req);
    const createdBy =
      (typeof body.createdBy === "string" && body.createdBy.trim()) ||
      claims?.sub ||
      "guest_local";

    const match = createAsyncSameSeedMatch({
      createdBy,
      opponentId: typeof body.opponentId === "string" ? body.opponentId : undefined,
      seed: typeof body.seed === "number" ? body.seed : undefined,
      config: body.config
    });

    return NextResponse.json(
      {
        match,
        standings: asyncMatchStandings(match)
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid async match payload" },
      { status: 400 }
    );
  }
}
