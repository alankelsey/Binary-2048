import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";

export async function AuthShell() {
  const session = await getServerSession(authOptions);
  const state = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  return (
    <div className="auth-shell" aria-label="Authentication status">
      <span className={`auth-tier auth-tier-${state.tier}`}>{state.tier}</span>
      <span className="auth-user">{state.displayName}</span>
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
