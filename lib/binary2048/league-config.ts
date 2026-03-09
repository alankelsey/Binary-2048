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

export function getLeagueConfig(namespace: "production" | "sandbox") {
  return store[namespace];
}

export function mirrorProductionConfigIntoSandbox() {
  store.sandbox = {
    ...store.production,
    updatedAtISO: nowISO()
  };
  return store.sandbox;
}

export function promoteSandboxConfigToProduction() {
  store.production = {
    ...store.sandbox,
    updatedAtISO: nowISO()
  };
  return store.production;
}

export function resetLeagueConfigForTests() {
  store.production = defaultConfig({ seedPoolId: "prod-seeds", undoLimit: 0 });
  store.sandbox = defaultConfig({ seedPoolId: "sandbox-seeds", undoLimit: 2 });
}

