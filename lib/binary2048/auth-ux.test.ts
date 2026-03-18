import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";
import type { AuthUiState } from "@/lib/binary2048/auth-ui";

describe("getAuthUxMessages", () => {
  it("returns guest guidance for unauthenticated users", () => {
    const guest: AuthUiState = {
      authenticated: false,
      displayName: "Guest",
      showDisplayName: false,
      email: null,
      tier: "guest",
      providersConfigured: true
    };
    const messages = getAuthUxMessages(guest);
    expect(messages.rankedSubmit).toContain("Sign in");
    expect(messages.dataExportDelete).toContain("Sign in");
    expect(messages.paidStoreActions).toContain("require a paid tier");
  });

  it("returns permissive messages for paid users", () => {
    const paid: AuthUiState = {
      authenticated: true,
      displayName: "Paid User",
      showDisplayName: true,
      email: "paid@example.com",
      tier: "paid",
      providersConfigured: true
    };
    const messages = getAuthUxMessages(paid);
    expect(messages.rankedSubmit).toContain("enabled");
    expect(messages.paidStoreActions).toContain("enabled");
    expect(messages.dataExportDelete).toContain("available");
  });
});
