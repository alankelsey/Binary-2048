import Link from "next/link";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getOptionalServerSession } from "@/lib/binary2048/server-session";

export async function AuthShell() {
  const session = await getOptionalServerSession("auth-shell");
  const state = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  return (
    <div
      className="auth-shell"
      aria-label="Authentication status"
      data-authenticated={state.authenticated ? "true" : "false"}
    >
      <span className={`auth-tier auth-tier-${state.tier}`}>{state.tier}</span>
      {state.showDisplayName ? <span className="auth-user">{state.displayName}</span> : null}
      {state.authenticated ? (
        <a href="/api/auth/signout?callbackUrl=/" className="auth-link">
          Sign out
        </a>
      ) : state.providersConfigured ? (
        <a href="/api/auth/signin" className="auth-link">
          Sign in
        </a>
      ) : (
        <Link href="/auth" className="auth-link">
          Auth setup
        </Link>
      )}
    </div>
  );
}
