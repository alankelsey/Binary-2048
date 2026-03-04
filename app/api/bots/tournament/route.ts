import { NextResponse } from "next/server";
import { runBotTournament, type BotId } from "@/lib/binary2048/bot-orchestrator";
import type { GameConfig } from "@/lib/binary2048/types";

type TournamentBody = {
  seeds?: number[];
  seedStart?: number;
  seedCount?: number;
  maxMoves?: number;
  bots?: BotId[];
  config?: Partial<GameConfig>;
};

const DEFAULT_SEED_START = 100;
const DEFAULT_SEED_COUNT = 3;
const DEFAULT_MAX_MOVES = 250;
const DEFAULT_BOTS: BotId[] = ["priority", "random", "alternate"];

function parseSeedList(body: TournamentBody) {
  if (Array.isArray(body.seeds) && body.seeds.length > 0) {
    return body.seeds
      .map((seed) => Number(seed))
      .filter((seed) => Number.isFinite(seed))
      .map((seed) => Math.floor(seed));
  }
  const seedStart = Number.isFinite(Number(body.seedStart)) ? Math.floor(Number(body.seedStart)) : DEFAULT_SEED_START;
  const seedCount = Number.isFinite(Number(body.seedCount))
    ? Math.max(1, Math.min(100, Math.floor(Number(body.seedCount))))
    : DEFAULT_SEED_COUNT;
  return Array.from({ length: seedCount }, (_, index) => seedStart + index);
}

function parseBots(raw: unknown): BotId[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BOTS;
  const allowed: BotId[] = ["priority", "random", "alternate"];
  const bots = raw.filter((bot): bot is BotId => allowed.includes(bot as BotId));
  return bots.length > 0 ? bots : DEFAULT_BOTS;
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) as TournamentBody);
    const seeds = parseSeedList(body);
    if (seeds.length === 0) {
      return NextResponse.json({ error: "No valid seeds provided" }, { status: 400 });
    }
    const maxMoves = Number.isFinite(Number(body.maxMoves))
      ? Math.max(1, Math.min(2000, Math.floor(Number(body.maxMoves))))
      : DEFAULT_MAX_MOVES;
    const bots = parseBots(body.bots);
    const result = runBotTournament({
      seeds,
      maxMoves,
      bots,
      config: body.config
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid tournament payload" },
      { status: 400 }
    );
  }
}
