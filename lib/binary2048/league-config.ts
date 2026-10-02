import { sharedOpsEnabled, readOpsValue, writeOpsValue } from "@/lib/binary2048/ops-shared";
export type LeagueConfig = {
  rulesetId: string;
  seedPoolId: string;
  maxMoves: number;
  undoLimit: number;
  updatedAtISO: string;
};

type LeagueConfigStore = {
  production: LeagueConfig;
  sandbox: LeagueConfig;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_league_config?: LeagueConfigStore;
};

function nowISO() {
  return new Date().toISOString();
}

function defaultConfig(overrides: Partial<LeagueConfig> = {}): LeagueConfig {
  return {
    rulesetId: "binary2048-v1",
    seedPoolId: "default",
    maxMoves: 500,
    undoLimit: 2,
    updatedAtISO: nowISO(),
    ...overrides
  };
}

const store: LeagueConfigStore = globalStore.__binary2048_league_config ?? {
  production: defaultConfig({ seedPoolId: "prod-seeds", undoLimit: 0 }),
  sandbox: defaultConfig({ seedPoolId: "sandbox-seeds", undoLimit: 2 })
};
globalStore.__binary2048_league_config = store;

export async function getLeagueConfig(namespace: "production" | "sandbox") {
  return sharedOpsEnabled() ? (await readOpsValue<LeagueConfig>(`league:${namespace}`)) ?? { ...store[namespace], updatedAtISO: "1970-01-01T00:00:00.000Z" } : store[namespace];
}

export async function mirrorProductionConfigIntoSandbox() {
  store.sandbox = {
    ...(await getLeagueConfig("production")),
    updatedAtISO: nowISO()
  };
  return sharedOpsEnabled() ? writeOpsValue("league:sandbox", store.sandbox) : store.sandbox;
}

export async function promoteSandboxConfigToProduction() {
  store.production = {
    ...(await getLeagueConfig("sandbox")),
    updatedAtISO: nowISO()
  };
  return sharedOpsEnabled() ? writeOpsValue("league:production", store.production) : store.production;
}

export function resetLeagueConfigForTests() {
  store.production = defaultConfig({ seedPoolId: "prod-seeds", undoLimit: 0 });
  store.sandbox = defaultConfig({ seedPoolId: "sandbox-seeds", undoLimit: 2 });
}

