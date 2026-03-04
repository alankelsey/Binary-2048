export type EnginePinMode = "exact" | "minor" | "off";

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function normalizeEnginePinMode(value: unknown): EnginePinMode {
  if (value === "exact" || value === "minor" || value === "off") return value;
  return "exact";
}

export function isEngineVersionCompatible(
  replayEngineVersion: string,
  expectedEngineVersion: string,
  mode: EnginePinMode
): boolean {
  if (mode === "off") return true;
  const replay = replayEngineVersion.trim();
  const expected = expectedEngineVersion.trim();
  if (!replay || !expected) return false;
  if (mode === "exact") return replay === expected;

  const replaySemver = parseSemver(replay);
  const expectedSemver = parseSemver(expected);
  if (!replaySemver || !expectedSemver) return replay === expected;
  return replaySemver.major === expectedSemver.major && replaySemver.minor === expectedSemver.minor;
}

