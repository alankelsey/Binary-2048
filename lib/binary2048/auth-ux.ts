import type { AuthUiState } from "@/lib/binary2048/auth-ui";

export type AuthUxMessages = {
  rankedSubmit: string;
  paidStoreActions: string;
  dataExportDelete: string;
};

export function getAuthUxMessages(state: AuthUiState): AuthUxMessages {
  return {
    rankedSubmit:
      state.authenticated
        ? "Ranked submissions are enabled for authenticated sessions."
        : "Sign in to submit ranked runs and appear on persistent leaderboards.",
    paidStoreActions:
      state.tier === "paid"
        ? "Paid-tier store actions are enabled."
        : "Paid store actions require a paid tier session.",
    dataExportDelete:
      state.authenticated
        ? "Data export/delete endpoints are available for your authenticated account."
        : "Sign in to use account data export/delete endpoints."
  };
}
