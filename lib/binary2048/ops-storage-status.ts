type StoreMode = {
  mode: string;
  scope: "shared" | "runtime" | "external";
};

function normalized(value: string | undefined, fallback: string): string {
  return (value ?? fallback).trim().toLowerCase() || fallback;
}

function databaseScope(mode: string): StoreMode["scope"] {
  return mode === "mongo" ? "shared" : "runtime";
}

export function getPassiveStorageStatus() {
  const runStore = normalized(process.env.BINARY2048_RUN_STORE, "memory");
  const sessionStore = normalized(process.env.BINARY2048_SESSION_STORE, runStore);
  const leaderboardStore = normalized(process.env.BINARY2048_LEADERBOARD_STORE, "memory");
  const rateLimitStore = normalized(process.env.BINARY2048_RATE_LIMIT_STORE, "memory");
  const replayArtifactStore = normalized(process.env.BINARY2048_REPLAY_ARTIFACT_STORE, "inline");

  return {
    generatedAtISO: new Date().toISOString(),
    passive: true,
    performsConnectivityCheck: false,
    stores: {
      runs: { mode: runStore, scope: databaseScope(runStore) },
      sessions: { mode: sessionStore, scope: databaseScope(sessionStore) },
      leaderboard: { mode: leaderboardStore, scope: databaseScope(leaderboardStore) },
      rateLimits: { mode: rateLimitStore, scope: databaseScope(rateLimitStore) },
      replayArtifacts: {
        mode: replayArtifactStore,
        scope: replayArtifactStore === "s3" ? "external" : "runtime"
      }
    },
    configuration: {
      mongoUriPresent: Boolean(process.env.BINARY2048_MONGO_URI),
      s3BucketPresent: Boolean(process.env.BINARY2048_REPLAY_S3_BUCKET)
    },
    activeProbe: {
      method: "POST",
      path: "/api/ops/storage/smoke"
    }
  };
}
