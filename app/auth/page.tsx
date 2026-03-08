import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";

export default async function AuthPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }
  const state = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  return (
    <main>
      <div className="card">
        <h1>Auth</h1>
        <p className="brand-subtitle">Session and provider status.</p>
        <p className="meta-text">Authenticated: {state.authenticated ? "yes" : "no"}</p>
        <p className="meta-text">Tier: {state.tier}</p>
        <p className="meta-text">User: {state.displayName}</p>
        <p className="meta-text">Email: {state.email ?? "n/a"}</p>
        <p className="meta-text">Providers configured: {state.providersConfigured ? "yes" : "no"}</p>
        <div className="row">
          <a className="button" href="/api/auth/signin">
            Sign in
          </a>
          <a className="button" href="/api/auth/signout?callbackUrl=/">
            Sign out
          </a>
          <a className="button" href="/api/auth/bridge-token">
            Mint bridge token
          </a>
        </div>
      </div>
    </main>
  );
}
