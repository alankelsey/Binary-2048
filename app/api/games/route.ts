import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";
import { deriveEntitlementsForTier } from "@/lib/binary2048/entitlements";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { DEFAULT_CONFIG, generateBitstormInitialGrid } from "@/lib/binary2048/engine";
import { verifyEntitlementProof } from "@/lib/binary2048/entitlement-proof";
import { createSession, getUndoMeta } from "@/lib/binary2048/sessions";
import { applyLockEconomyPolicy, type LockEconomyContext } from "@/lib/binary2048/lock-economy";
import type { Cell, GameConfig } from "@/lib/binary2048/types";
import type { UserTier } from "@/lib/binary2048/security-policy";

type CreateGameBody = {
  config?: Partial<GameConfig>;
  initialGrid?: Cell[][];
  mode?: "classic" | "bitstorm";
  economy?: {
    sessionClass?: "ranked" | "unranked";
    userTier?: UserTier;
    entitlements?: string[];
    proof?: string;
  };
};

function mergeConfig(config: Partial<GameConfig> | undefined): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      ...(config?.spawn ?? {})
    }
  };
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = ((raw && typeof raw === "object" ? raw : {}) as CreateGameBody);
    let config = body.config;
    let initialGrid = body.initialGrid;
    const requestedSeed = body.config?.seed;
    const effectiveSeed = typeof requestedSeed === "number" ? requestedSeed : randomSeed();
    const mode = body.mode === "bitstorm" ? "bitstorm" : "classic";
    const sessionClass = body.economy?.sessionClass === "ranked" ? "ranked" : "unranked";
    const authClaims = getVerifiedAuthClaims(req);
    const userTier = authClaims?.tier ?? body.economy?.userTier ?? "guest";
    const challenge = evaluateChallenge({ req, route: "/api/games", risk: "medium", userTier });
    if (!challenge.allowed) {
      return NextResponse.json(
        {
          error: "Challenge required",
          route: "/api/games",
          reason: challenge.reason,
          mode: challenge.mode
        },
        { status: 403 }
      );
    }
    const plainEntitlements = Array.isArray(body.economy?.entitlements) ? body.economy?.entitlements : [];
    const proofSecret = process.env.BINARY2048_ENTITLEMENT_SECRET ?? "";
    const proofEntitlements = verifyEntitlementProof(body.economy?.proof, proofSecret);
    const authEntitlements = authClaims
      ? deriveEntitlementsForTier(authClaims.tier, authClaims.entitlements)
      : [];
    const entitlements =
      sessionClass === "ranked"
        ? (proofEntitlements.length > 0 ? proofEntitlements : authEntitlements)
        : plainEntitlements;
    const economyContext: LockEconomyContext = { sessionClass, userTier, entitlements };

    if (!initialGrid && mode === "bitstorm") {
      const merged = mergeConfig(config);
      const effectiveConfig = applyLockEconomyPolicy({ ...merged, seed: effectiveSeed }, economyContext);
      initialGrid = generateBitstormInitialGrid(effectiveConfig);
      config = effectiveConfig;
    } else {
      const merged = mergeConfig(config);
      config = applyLockEconomyPolicy({ ...merged, seed: effectiveSeed }, economyContext);
    }

    const session = createSession(config, initialGrid, { sessionClass });
    return NextResponse.json({
      id: session.current.id,
      current: session.current,
      steps: session.steps,
      undo: getUndoMeta(session),
      integrity: session.integrity,
      economy: {
        sessionClass,
        userTier,
        lockTilesEnabled: session.current.config.spawn.pLock > 0,
        canContinueAfterWin: canContinueAfterWin(sessionClass)
      },
      mode
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 400 }
    );
  }
}
