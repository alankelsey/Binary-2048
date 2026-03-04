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

function parseHeaderSize(header: Record<string, unknown>) {
  if (typeof header.size !== "number" || !Number.isInteger(header.size) || header.size < 2) {
    throw new Error("Replay header must include integer size >= 2");
  }
  return header.size;
}

function parseHeaderSeed(header: Record<string, unknown>) {
  if (typeof header.seed !== "number" || !Number.isFinite(header.seed)) {
    throw new Error("Replay header must include numeric seed");
  }
  return Math.floor(header.seed);
}

function parseHeaderCreatedAt(header: Record<string, unknown>) {
  if (typeof header.createdAt !== "string" || header.createdAt.trim().length === 0) {
    throw new Error("Replay header must include createdAt");
  }
  if (Number.isNaN(Date.parse(header.createdAt))) {
    throw new Error("Replay header createdAt must be a valid ISO date string");
  }
  return header.createdAt;
}

export function validateReplayHeader(
  header: ReplayHeader,
  config: Pick<GameConfig, "width" | "height" | "seed">,
  initialGrid: Cell[][]
) {
  if (header.replayVersion !== 1) {
    throw new Error(`Unsupported replayVersion: ${String(header.replayVersion)}`);
  }
  if (!header.rulesetId || typeof header.rulesetId !== "string") {
    throw new Error("Replay header must include rulesetId");
  }
  if (!header.engineVersion || typeof header.engineVersion !== "string") {
    throw new Error("Replay header must include engineVersion");
  }
  if (!Number.isInteger(header.size) || header.size < 2) {
    throw new Error("Replay header size must be integer >= 2");
  }
  if (header.size !== config.width || header.size !== config.height) {
    throw new Error("Replay header size must match config width/height");
  }
  if (header.seed !== config.seed) {
    throw new Error("Replay header seed must match config seed");
  }
  if (!Array.isArray(initialGrid) || initialGrid.length !== header.size) {
    throw new Error("Replay initialGrid height must match replay header size");
  }
  for (const row of initialGrid) {
    if (!Array.isArray(row) || row.length !== header.size) {
      throw new Error("Replay initialGrid width must match replay header size");
    }
  }
  if (Number.isNaN(Date.parse(header.createdAt))) {
    throw new Error("Replay header createdAt must be a valid ISO date string");
  }
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
  if (isGameExportPayload(value)) {
    const compact = exportToCompactReplay(value);
    validateReplayHeader(compact.header, compact.config, compact.initialGrid);
    return compact;
  }

  const header = value.header;
  const config = value.config;
  const initialGrid = value.initialGrid;
  const moves = value.moves;

  if (!isObject(header)) throw new Error("Missing replay header");
  if (!isObject(config)) throw new Error("Missing replay config");
  if (!Array.isArray(initialGrid)) throw new Error("Missing replay initialGrid");
  if (!Array.isArray(moves) || moves.length === 0) throw new Error("moves must be a non-empty array");
  if (header.replayVersion !== 1) throw new Error(`Unsupported replayVersion: ${String(header.replayVersion)}`);
  if (typeof header.rulesetId !== "string" || !header.rulesetId) {
    throw new Error("Replay header must include rulesetId");
  }
  if (typeof header.engineVersion !== "string" || !header.engineVersion) {
    throw new Error("Replay header must include engineVersion");
  }

  const compact = {
    header: {
      replayVersion: 1 as const,
      rulesetId: header.rulesetId,
      engineVersion: header.engineVersion,
      size: parseHeaderSize(header),
      seed: parseHeaderSeed(header),
      createdAt: parseHeaderCreatedAt(header)
    },
    config: config as GameConfig,
    initialGrid: initialGrid as Cell[][],
    moves: moves as AnyAction[]
  };
  validateReplayHeader(compact.header, compact.config, compact.initialGrid);
  return compact;
}
