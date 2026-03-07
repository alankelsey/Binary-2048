type HeavyRoute = "simulate" | "bots_tournament";

type DegradeState = {
  disabled: boolean;
  reason: "global" | "route" | null;
};

function isTrue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const ROUTE_FLAGS: Record<HeavyRoute, string> = {
  simulate: "BINARY2048_DEGRADE_DISABLE_SIMULATE",
  bots_tournament: "BINARY2048_DEGRADE_DISABLE_TOURNAMENT"
};

export function getDegradeState(route: HeavyRoute, env: Record<string, string | undefined> = process.env): DegradeState {
  if (isTrue(env.BINARY2048_DEGRADE_MODE)) {
    return { disabled: true, reason: "global" };
  }
  if (isTrue(env[ROUTE_FLAGS[route]])) {
    return { disabled: true, reason: "route" };
  }
  return { disabled: false, reason: null };
}
