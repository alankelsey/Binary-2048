export type UIControl = "difficulty" | "color" | "mode" | "import" | "export";

export type UIPolicy = {
  controls: Record<UIControl, boolean>;
  showOptionsButton: boolean;
  adminMode: boolean;
  allOnInDev: boolean;
};

const CONTROL_KEYS: UIControl[] = ["difficulty", "color", "mode", "import", "export"];

function parseDisabledControls(raw: string | undefined): Set<UIControl> {
  if (!raw) return new Set();
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const out = new Set<UIControl>();
  for (const part of parts) {
    if (CONTROL_KEYS.includes(part as UIControl)) {
      out.add(part as UIControl);
    }
  }
  return out;
}

export function getUiPolicy(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV
): UIPolicy {
  const isDev = nodeEnv !== "production";
  const adminMode = env.NEXT_PUBLIC_UI_ADMIN_MODE === "1";
  const allOnInDev = isDev;
  const disabled = parseDisabledControls(env.NEXT_PUBLIC_UI_DISABLED_CONTROLS);

  const controls: Record<UIControl, boolean> = {
    difficulty: true,
    color: true,
    mode: true,
    import: true,
    export: true
  };

  for (const key of CONTROL_KEYS) {
    if (disabled.has(key) && (!allOnInDev || adminMode)) {
      controls[key] = false;
    }
  }

  return {
    controls,
    showOptionsButton: CONTROL_KEYS.some((key) => controls[key]),
    adminMode,
    allOnInDev
  };
}
