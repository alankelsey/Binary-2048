import type { AnyAction } from "@/lib/binary2048/action";
import type { Cell, GameConfig, GameExport } from "@/lib/binary2048/types";

export type ReplayHeader = {
  replayVersion: 1;
  rulesetId: string;
  engineVersion: string;
  size: number;
  seed: number;
  createdAt: string;
};

export type CompactReplayPayload = {
  header: ReplayHeader;
  config: GameConfig;
  initialGrid: Cell[][];
  moves: AnyAction[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameExportPayload(value: unknown): value is GameExport {
  if (!isObject(value)) return false;
  return (
    typeof value.version === "number" &&
    isObject(value.meta) &&
    isObject(value.config) &&
    isObject(value.initial) &&
    Array.isArray((value.initial as { grid?: unknown }).grid)
  );
}

function defaultCreatedAt(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : new Date(0).toISOString();
}

export function exportToReplayHeader(exported: GameExport): ReplayHeader {
  return {
    replayVersion: 1,
    rulesetId: exported.meta?.rulesetId ?? "binary2048-v1",
    engineVersion: exported.meta?.engineVersion ?? "dev",
    size: exported.config.width,
    seed: exported.meta?.replay?.seed ?? exported.config.seed,
    createdAt: defaultCreatedAt(exported.meta?.createdAtISO)
  };
}

export function exportToCompactReplay(exported: GameExport): CompactReplayPayload {
  return {
    header: exportToReplayHeader(exported),
    config: exported.config,
    initialGrid: exported.initial.grid,
    moves: exported.meta?.replay?.moves ?? exported.steps.map((step) => step.dir)
  };
}

export function toCompactReplayPayload(value: unknown): CompactReplayPayload {
  if (!isObject(value)) throw new Error("Invalid replay payload");
  if (isGameExportPayload(value)) return exportToCompactReplay(value);

  const header = value.header;
  const config = value.config;
  const initialGrid = value.initialGrid;
  const moves = value.moves;

  if (!isObject(header)) throw new Error("Missing replay header");
  if (!isObject(config)) throw new Error("Missing replay config");
  if (!Array.isArray(initialGrid)) throw new Error("Missing replay initialGrid");
  if (!Array.isArray(moves) || moves.length === 0) throw new Error("moves must be a non-empty array");

  return {
    header: {
      replayVersion: 1,
      rulesetId: typeof header.rulesetId === "string" ? header.rulesetId : "binary2048-v1",
      engineVersion: typeof header.engineVersion === "string" ? header.engineVersion : "dev",
      size: typeof header.size === "number" ? Math.floor(header.size) : (config.width as number),
      seed:
        typeof header.seed === "number"
          ? Math.floor(header.seed)
          : typeof (config as { seed?: unknown }).seed === "number"
            ? Math.floor((config as { seed: number }).seed)
            : 0,
      createdAt: typeof header.createdAt === "string" ? header.createdAt : new Date(0).toISOString()
    },
    config: config as GameConfig,
    initialGrid: initialGrid as Cell[][],
    moves: moves as AnyAction[]
  };
}
