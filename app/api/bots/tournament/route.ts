import { NextResponse } from "next/server";
import { runBotTournament, type BotId } from "@/lib/binary2048/bot-orchestrator";
import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";
import { EndpointCostCapError, TOURNAMENT_MAX_MOVES, TOURNAMENT_MAX_SEEDS } from "@/lib/binary2048/cost-caps";
import { getDegradeState } from "@/lib/binary2048/degrade-mode";
import { recordRouteTelemetry } from "@/lib/binary2048/ops-telemetry";
import { checkTournamentRateLimit } from "@/lib/binary2048/rate-limit";
import {
  acquireTournamentSlot,
  getTournamentQueueStats,
  resolveTournamentQueueOptions,
  TournamentQueueFullError,
  TournamentQueueTimeoutError
} from "@/lib/binary2048/tournament-queue";
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
const DEFAULT_BOTS: BotId[] = ["priority", "random", "alternate", "rollout"];

function parseSeedList(body: TournamentBody) {
  if (Array.isArray(body.seeds) && body.seeds.length > 0) {
    if (body.seeds.length > TOURNAMENT_MAX_SEEDS) {
      throw new EndpointCostCapError("seeds", TOURNAMENT_MAX_SEEDS, body.seeds.length);
    }
    return body.seeds
      .map((seed) => Number(seed))
      .filter((seed) => Number.isFinite(seed))
      .map((seed) => Math.floor(seed));
  }
  const seedStart = Number.isFinite(Number(body.seedStart)) ? Math.floor(Number(body.seedStart)) : DEFAULT_SEED_START;
  const seedCount = Number.isFinite(Number(body.seedCount)) ? Math.max(1, Math.floor(Number(body.seedCount))) : DEFAULT_SEED_COUNT;
  if (seedCount > TOURNAMENT_MAX_SEEDS) {
    throw new EndpointCostCapError("seedCount", TOURNAMENT_MAX_SEEDS, seedCount);
  }
  return Array.from({ length: seedCount }, (_, index) => seedStart + index);
}

function parseBots(raw: unknown): BotId[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BOTS;
  const allowed: BotId[] = ["priority", "random", "alternate", "rollout"];
  const bots = raw.filter((bot): bot is BotId => allowed.includes(bot as BotId));
  return bots.length > 0 ? bots : DEFAULT_BOTS;
}

export async function POST(req: Request) {
  const startedAtMs = Date.now();
  let statusCode = 200;
  let slot: Awaited<ReturnType<typeof acquireTournamentSlot>> | null = null;
  try {
    const degrade = getDegradeState("bots_tournament");
    if (degrade.disabled) {
      statusCode = 503;
      return NextResponse.json(
        {
          error: "Endpoint temporarily disabled",
          code: "degrade_mode",
          route: "bots_tournament",
          reason: degrade.reason
        },
        { status: 503, headers: { "retry-after": "60" } }
      );
    }
    const challenge = evaluateChallenge({ req, route: "/api/bots/tournament", risk: "high", userTier: "guest" });
    if (!challenge.allowed) {
      statusCode = 403;
      return NextResponse.json(
        {
          error: "Challenge required",
          route: "/api/bots/tournament",
          reason: challenge.reason,
          mode: challenge.mode
        },
        { status: 403 }
      );
    }
    const quota = checkTournamentRateLimit(req);
    if (!quota.allowed) {
      statusCode = 429;
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          route: "bots_tournament",
          limit: quota.limit,
          remaining: quota.remaining,
          retryAfterSeconds: quota.retryAfterSeconds
        },
        { status: 429, headers: { "retry-after": String(quota.retryAfterSeconds) } }
      );
    }
    slot = await acquireTournamentSlot(resolveTournamentQueueOptions());
    const body = ((await req.json().catch(() => ({}))) as TournamentBody);
    const seeds = parseSeedList(body);
    if (seeds.length === 0) {
      return NextResponse.json({ error: "No valid seeds provided" }, { status: 400 });
    }
    const maxMoves = Number.isFinite(Number(body.maxMoves)) ? Math.max(1, Math.floor(Number(body.maxMoves))) : DEFAULT_MAX_MOVES;
    if (maxMoves > TOURNAMENT_MAX_MOVES) {
      throw new EndpointCostCapError("maxMoves", TOURNAMENT_MAX_MOVES, maxMoves);
    }
    const bots = parseBots(body.bots);
    const result = runBotTournament({
      seeds,
      maxMoves,
      bots,
      config: body.config
    });
    return NextResponse.json(
      {
        ...result,
        queue: getTournamentQueueStats()
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof EndpointCostCapError) {
      statusCode = 400;
      return NextResponse.json(
        { error: error.message, code: error.code, field: error.field, limit: error.limit, value: error.value },
        { status: 400 }
      );
    }
    if (error instanceof TournamentQueueFullError) {
      statusCode = 503;
      return NextResponse.json(
        {
          error: "Tournament capacity reached",
          code: "queue_full",
          queue: getTournamentQueueStats()
        },
        { status: 503 }
      );
    }
    if (error instanceof TournamentQueueTimeoutError) {
      statusCode = 503;
      return NextResponse.json(
        {
          error: "Tournament queue wait timeout",
          code: "queue_timeout",
          queue: getTournamentQueueStats()
        },
        { status: 503 }
      );
    }
    statusCode = 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid tournament payload" },
      { status: 400 }
    );
  } finally {
    slot?.release();
    recordRouteTelemetry({
      route: "/api/bots/tournament",
      status: statusCode,
      durationMs: Date.now() - startedAtMs,
      costUnits: 5
    });
  }
}
