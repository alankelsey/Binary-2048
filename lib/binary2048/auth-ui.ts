export type AuthUiState = {
  authenticated: boolean;
  displayName: string;
  showDisplayName: boolean;
  email: string | null;
  tier: "guest" | "authed" | "paid";
  providersConfigured: boolean;
};

function normalizeTier(value: unknown): AuthUiState["tier"] {
  if (value === "guest" || value === "authed" || value === "paid") return value;
  return "authed";
}

export function buildAuthUiState(
  session: unknown,
  providerCount: number
): AuthUiState {
  const providersConfigured = providerCount > 0;
  if (!session || typeof session !== "object") {
    return {
      authenticated: false,
      displayName: "Guest",
      showDisplayName: false,
      email: null,
      tier: "guest",
      providersConfigured
    };
  }
  const record = session as Record<string, unknown>;
  const user = (record.user ?? {}) as Record<string, unknown>;
  const name = typeof user.name === "string" && user.name.trim().length > 0 ? user.name.trim() : "Authenticated user";
  const email = typeof user.email === "string" && user.email.trim().length > 0 ? user.email.trim() : null;
  return {
    authenticated: true,
    displayName: name,
    showDisplayName: true,
    email,
    tier: normalizeTier(record.tier),
    providersConfigured
  };
}
