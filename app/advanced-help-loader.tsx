"use client";

import { useEffect, useState, type ComponentType } from "react";

type LoadState = "loading" | "ready" | "error";

export default function AdvancedHelpLoader() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [Body, setBody] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    import("./advanced-help-body")
      .then((module) => {
        if (cancelled) return;
        setBody(() => module.default);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === "loading") return <p role="status">Loading game help…</p>;
  if (state === "error") {
    return (
      <div role="alert">
        <p>Game help could not be loaded.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry help</button>
      </div>
    );
  }
  return Body ? <Body /> : null;
}
