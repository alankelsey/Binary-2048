import type { UserTier } from "@/lib/binary2048/security-policy";

export type ChallengeMode = "off" | "log" | "enforce";
export type ChallengeRiskProfile = "low" | "medium" | "high";

type EvaluateChallengeInput = {
  req: Request;
  route: string;
  risk: ChallengeRiskProfile;
  userTier?: UserTier;
};

type ChallengeDecision = {
  allowed: boolean;
  challengeRequired: boolean;
  mode: ChallengeMode;
  reason?: string;
};

function normalizeMode(raw: string | undefined): ChallengeMode {
  if (raw === "off" || raw === "log" || raw === "enforce") return raw;
  return "off";
}

function requiresChallenge(risk: ChallengeRiskProfile, userTier: UserTier): boolean {
  if (risk === "low") return false;
  if (risk === "medium") return userTier === "guest";
  return true;
}

function readChallengeToken(req: Request): string {
  return req.headers.get("x-binary2048-challenge-token")?.trim() ?? "";
}

export function evaluateChallenge(input: EvaluateChallengeInput): ChallengeDecision {
  const mode = normalizeMode(process.env.BINARY2048_CHALLENGE_MODE);
  if (mode === "off") {
    return { allowed: true, challengeRequired: false, mode };
  }

  const userTier = input.userTier ?? "guest";
  const challengeRequired = requiresChallenge(input.risk, userTier);
  if (!challengeRequired) {
    return { allowed: true, challengeRequired: false, mode };
  }

  const expected = process.env.BINARY2048_CHALLENGE_SECRET?.trim() ?? "";
  const provided = readChallengeToken(input.req);
  const valid = expected.length > 0 && provided.length > 0 && provided === expected;
  if (valid) {
    return { allowed: true, challengeRequired: true, mode };
  }
  if (mode === "log") {
    return { allowed: true, challengeRequired: true, mode, reason: "challenge_missing_or_invalid" };
  }
  return {
    allowed: false,
    challengeRequired: true,
    mode,
    reason: "challenge_missing_or_invalid"
  };
}

