"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buildAuthUiState, type AuthUiState } from "@/lib/binary2048/auth-ui";

type AuthStatus = "pending" | "ready" | "error";

export function AuthShell({ providersConfigured }: { providersConfigured: boolean }) {
  const [status, setStatus] = useState<AuthStatus>("pending");
  const [state, setState] = useState<AuthUiState>(() => buildAuthUiState(null, providersConfigured ? 1 : 0));

  const hydrate = useCallback(async () => {
    setStatus("pending");
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Session lookup failed");
      const session = await response.json().catch(() => null);
      const next = buildAuthUiState(session, providersConfigured ? 1 : 0);
      setState(next);
      setStatus("ready");
      window.dispatchEvent(new CustomEvent("binary2048:auth-state", {
        detail: { authenticated: next.authenticated, status: "ready" }
      }));
    } catch {
      setState(buildAuthUiState(null, providersConfigured ? 1 : 0));
      setStatus("error");
      window.dispatchEvent(new CustomEvent("binary2048:auth-state", {
        detail: { authenticated: false, status: "error" }
      }));
    }
  }, [providersConfigured]);

  useEffect(() => {
    performance.mark("binary2048:auth-hydration-start");
    void hydrate().finally(() => performance.mark("binary2048:auth-hydration-complete"));
  }, [hydrate]);

  return (
    <div
      className="auth-shell"
      aria-label="Authentication status"
      data-authenticated={status === "ready" && state.authenticated ? "true" : "false"}
      data-auth-state={status}
    >
      {status === "pending" ? <span role="status">Checking account…</span> : null}
      {status === "error" ? <>
        <span role="alert">Account status unavailable.</span>
        <button type="button" className="auth-link" onClick={() => void hydrate()}>Retry</button>
      </> : null}
      {status === "ready" ? <>
        <span className={`auth-tier auth-tier-${state.tier}`}>{state.tier}</span>
        {state.showDisplayName ? <span className="auth-user">{state.displayName}</span> : null}
        {state.authenticated ? (
          <a href="/api/auth/signout?callbackUrl=/" className="auth-link">Sign out</a>
        ) : state.providersConfigured ? (
          <a href="/api/auth/signin" className="auth-link">Sign in</a>
        ) : (
          <Link href="/auth" className="auth-link">Auth setup</Link>
        )}
      </> : null}
    </div>
  );
}
