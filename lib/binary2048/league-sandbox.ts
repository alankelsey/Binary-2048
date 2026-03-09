type SubmissionFlags = {
  namespace?: "production" | "sandbox";
  isSandbox?: boolean;
  isPractice?: boolean;
  seasonMode?: "live" | "preview";
  shadowWrite?: boolean;
};

type SandboxAccessResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

const globalRateStore = globalThis as typeof globalThis & {
  __binary2048_sandbox_rate?: Map<string, number[]>;
};

const rateStore = globalRateStore.__binary2048_sandbox_rate ?? new Map<string, number[]>();
globalRateStore.__binary2048_sandbox_rate = rateStore;

function listApiKeys() {
  const raw = process.env.BINARY2048_SANDBOX_API_KEYS ?? "";
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function isSandboxTarget(flags: SubmissionFlags) {
  if (flags.shadowWrite) return true;
  if (flags.namespace === "sandbox") return true;
  if (flags.isSandbox) return true;
  if (flags.isPractice) return true;
  if (flags.seasonMode === "preview") return true;
  return false;
}

export function resolveSandboxSubmissionMode(flags: SubmissionFlags) {
  const shadowWrite = flags.shadowWrite ?? process.env.BINARY2048_LEAGUE_SHADOW_WRITE === "true";
  const sandbox = isSandboxTarget({ ...flags, shadowWrite });
  const namespace = sandbox ? "sandbox" : "production";
  const seasonMode = flags.seasonMode ?? (sandbox ? "preview" : "live");
  return {
    namespace,
    isSandbox: sandbox,
    isPractice: Boolean(flags.isPractice),
    seasonMode,
    shadowWrite
  } as const;
}

export function verifySandboxSubmissionAccess(req: Request, flags: SubmissionFlags): SandboxAccessResult {
  const mode = resolveSandboxSubmissionMode(flags);
  if (!mode.isSandbox && !mode.isPractice) return { ok: true };

  const keys = listApiKeys();
  if (keys.length === 0) return { ok: true };
  const provided = req.headers.get("x-league-client-key") ?? "";
  if (!provided || !keys.includes(provided)) {
    return { ok: false, status: 401, error: "Valid league sandbox API key required" };
  }

  const limit = parsePositiveInt(process.env.BINARY2048_SANDBOX_RATE_LIMIT_PER_5M, 120);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  const key = `${provided}:${ip}`;
  const existing = rateStore.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    rateStore.set(key, recent);
    return { ok: false, status: 429, error: "Sandbox submission rate limit exceeded" };
  }
  recent.push(now);
  rateStore.set(key, recent);
  return { ok: true };
}

export function resetSandboxRateLimitForTests() {
  rateStore.clear();
}

