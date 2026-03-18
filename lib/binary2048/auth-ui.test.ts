import { buildAuthUiState } from "@/lib/binary2048/auth-ui";

describe("buildAuthUiState", () => {
  it("returns guest state when session is absent", () => {
    const state = buildAuthUiState(null, 0);
    expect(state).toEqual({
      authenticated: false,
      displayName: "Guest",
      showDisplayName: false,
      email: null,
      tier: "guest",
      providersConfigured: false
    });
  });

  it("returns authenticated tiered state from session payload", () => {
    const state = buildAuthUiState(
      {
        user: { name: "Alan", email: "alan@example.com" },
        tier: "paid"
      },
      2
    );
    expect(state.authenticated).toBe(true);
    expect(state.displayName).toBe("Alan");
    expect(state.showDisplayName).toBe(true);
    expect(state.email).toBe("alan@example.com");
    expect(state.tier).toBe("paid");
    expect(state.providersConfigured).toBe(true);
  });
});
